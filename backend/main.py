import os
import json
import time
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import torch

from .config import STATIC_DIR
from .locations_data import PRESET_LOCATIONS
from .geocoding import geocode_location
from .pipeline import (
    run_analysis_pipeline,
    get_available_scene_dates,
    build_bbox_from_point
)
from .hotspots import get_hotspots_for_location, PRESET_HOTSPOTS
from .vision_inspector import execute_zoom_and_verify_agent
from .wayback_live import check_wayback_availability
from .building_segmentor import (
    BuildingSegmentor,
    compare_building_change,
    get_inference_device
)
from .multiscale_verifier import run_multiscale_verification
from .municipal_fusion import fuse_municipal_evidence, build_municipal_case

BASE_DIR = Path(__file__).resolve().parent.parent
PUBLIC_DIR = BASE_DIR / "public"
OUTPUTS_DIR = BASE_DIR / "outputs"
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="Nagpur EarthWatch — Urban Change Intelligence API",
    description="Dual-tier satellite change detection pipeline combining 10m Copernicus Sentinel-2 multispectral granules, 0.6m Esri Wayback historical mosaics, and AI Zoom-and-Verify Agent.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.responses import FileResponse, JSONResponse

# Mount static files directory for serving satellite imagery & overlays
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
app.mount("/outputs", StaticFiles(directory=str(OUTPUTS_DIR)), name="outputs")
if PUBLIC_DIR.exists():
    app.mount("/public", StaticFiles(directory=str(PUBLIC_DIR)), name="public")

# In-memory inspection cache
INSPECTION_CACHE: Dict[str, Dict[str, Any]] = {}
YOLO_RESULTS_CACHE: Dict[str, Dict[str, Any]] = {}


@app.get("/{filename}.png")
async def get_public_png(filename: str):
    file_path = PUBLIC_DIR / f"{filename}.png"
    if file_path.exists():
        return FileResponse(file_path)
    # Check in static
    static_file = STATIC_DIR / f"{filename}.png"
    if static_file.exists():
        return FileResponse(static_file)
    raise HTTPException(status_code=404, detail="Image not found")


@app.get("/{filename}.jpg")
async def get_public_jpg(filename: str):
    file_path = PUBLIC_DIR / f"{filename}.jpg"
    if file_path.exists():
        return FileResponse(file_path)
    static_file = STATIC_DIR / f"{filename}.jpg"
    if static_file.exists():
        return FileResponse(static_file)
    raise HTTPException(status_code=404, detail="Image not found")


class AnalyzeRequest(BaseModel):
    location_name: Optional[str] = Field(None, description="Location name or landmark in Nagpur (e.g. Civil Lines, Sadar, Hingna, MIHAN, Sitabuldi)")
    lat: Optional[float] = Field(None, description="Latitude coordinate")
    lng: Optional[float] = Field(None, description="Longitude coordinate")
    before_date: Optional[str] = Field(None, description="Baseline date YYYY-MM-DD")
    after_date: Optional[str] = Field(None, description="Current date YYYY-MM-DD")


class InspectHotspotRequest(BaseModel):
    hotspot_id: str = Field(..., description="Hotspot identifier e.g. MIHAN-042 or CIVILLINES-001")
    location_id: str = Field("mihan", description="Location identifier")
    hotspot_data: Optional[Dict[str, Any]] = Field(None, description="Complete candidate hotspot metadata")


class InspectAllRequest(BaseModel):
    location_id: str = Field("mihan", description="Location identifier")


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "Nagpur EarthWatch Universal Intelligence API"}


@app.get("/api/locations")
async def get_preset_locations():
    """Returns pre-analyzed validated locations (MIHAN, Sadar, Hingna MIDC, Civil Lines)."""
    return {"locations": PRESET_LOCATIONS, "count": len(PRESET_LOCATIONS)}


@app.get("/api/available-dates")
async def get_available_dates(
    lat: Optional[float] = Query(None, description="Latitude"),
    lng: Optional[float] = Query(None, description="Longitude"),
    location_name: Optional[str] = Query(None, description="Location name"),
    start_date: str = Query("2020-01-01", description="Start date YYYY-MM-DD"),
    end_date: str = Query("2025-03-01", description="End date YYYY-MM-DD"),
):
    """
    Returns available Sentinel-2 scene dates from Copernicus CDSE catalog for the given AOI,
    including cloud cover percentage and usability status (<15% cloud cover).
    """
    if lat is None or lng is None:
        if not location_name:
            lat, lng, display_name = 21.1458, 79.0882, "Nagpur Central"
        else:
            lat, lng, display_name = await geocode_location(location_name)
    else:
        display_name = location_name or f"AOI ({lat:.4f}, {lng:.4f})"

    bbox = build_bbox_from_point(lat, lng, padding=0.024)
    dates = get_available_scene_dates(bbox, start_date=start_date, end_date=end_date)
    return {
        "location_name": display_name,
        "lat": lat,
        "lng": lng,
        "dates": dates,
        "count": len(dates)
    }


@app.get("/api/wayback-availability")
async def get_wayback_status(
    lat: float = Query(21.1458, description="Latitude"),
    lng: float = Query(79.0882, description="Longitude"),
    padding: float = Query(0.024, description="Bounding box half-span in degrees")
):
    """
    Checks Wayback historical availability for any location or coordinates in Nagpur.
    """
    bbox = [lng - padding, lat - padding, lng + padding, lat + padding]
    return check_wayback_availability(bbox)


@app.post("/api/analyze")
async def analyze_location(req: AnalyzeRequest, request: Request):
    """
    Universal Location Analysis Endpoint:
    1. Geocodes location with Nominatim
    2. Runs Sentinel-2 10m L2A optical difference + SSIM structural divergence matrix
    3. Checks and stitches high-resolution Esri Wayback ~0.6m historical imagery
    4. Extracts candidate spatial change hotspots and returns dual-tier results
    """
    if not req.location_name and (req.lat is None or req.lng is None):
        raise HTTPException(
            status_code=400,
            detail={"status": "error", "reason": "Either 'location_name' or ('lat' and 'lng') must be provided."}
        )

    # 1. Geocode if location_name provided
    if req.location_name:
        lat, lng, display_name = await geocode_location(req.location_name)
    else:
        lat, lng = req.lat, req.lng
        display_name = f"Custom AOI ({lat:.4f}° N, {lng:.4f}° E)"

    base_url = str(request.base_url).rstrip("/")

    # 2. Run analysis pipeline
    try:
        result = run_analysis_pipeline(
            lat=lat,
            lng=lng,
            location_name=display_name,
            before_date=req.before_date,
            after_date=req.after_date,
            base_url=base_url
        )
        return result
    except ValueError as ve:
        raise HTTPException(
            status_code=422,
            detail={"status": "error", "reason": str(ve)}
        )
    except Exception as e:
        print(f"Pipeline error for {display_name}: {e}")
        raise HTTPException(
            status_code=500,
            detail={"status": "error", "reason": f"Analysis pipeline failed: {str(e)}"}
        )


# ==========================================
# AI ZOOM-AND-VERIFY AGENT ENDPOINTS
# ==========================================

@app.get("/api/hotspots")
async def get_hotspots(location_id: str = Query("mihan", description="Location identifier")):
    """
    Returns extracted spatial change hotspots for a given sector,
    ranked by priority score (CRITICAL, HIGH, MEDIUM, LOW) with area in m² and bounding boxes.
    """
    hotspots = get_hotspots_for_location(location_id)
    return {
        "location_id": location_id,
        "hotspots": hotspots,
        "count": len(hotspots),
        "high_priority_count": sum(1 for h in hotspots if h.get("priority") in ["CRITICAL", "HIGH"])
    }


@app.post("/api/inspect-hotspot")
async def inspect_hotspot(req: InspectHotspotRequest, request: Request):
    """
    Executes the AI Zoom-and-Verify Agent on a specific candidate hotspot:
    1. Retrieves candidate hotspot bounding box
    2. Generates geographically aligned 0.6m Wayback crops (Level 1 to Level 4)
    3. Runs AI Vision inspection and change categorization
    4. Fuses multi-tier EarthWatch Composite Confidence scores
    5. Formulates the complete Government Inspection Case
    """
    cache_key = f"{req.location_id.lower()}_{req.hotspot_id.upper()}"
    base_url = str(request.base_url).rstrip("/")

    try:
        case_file = execute_zoom_and_verify_agent(
            hotspot_id=req.hotspot_id,
            location_id=req.location_id,
            hotspot_data=req.hotspot_data,
            base_url=base_url
        )
        INSPECTION_CACHE[cache_key] = case_file
        return {
            "status": "success",
            "case": case_file
        }
    except Exception as e:
        print(f"Inspection agent error for {req.hotspot_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail={"status": "error", "reason": f"Inspection failed: {str(e)}"}
        )


@app.post("/api/inspect-all")
async def inspect_all_hotspots(req: InspectAllRequest, request: Request):
    """
    Batch executes the AI Zoom-and-Verify Agent across all candidate hotspots for a sector.
    """
    base_url = str(request.base_url).rstrip("/")
    hotspots = get_hotspots_for_location(req.location_id)
    cases = []

    for h in hotspots:
        hid = h.get("hotspot_id", "")
        if not hid:
            continue
        try:
            case_file = execute_zoom_and_verify_agent(
                hotspot_id=hid,
                location_id=req.location_id,
                base_url=base_url
            )
            cache_key = f"{req.location_id.lower()}_{hid.upper()}"
            INSPECTION_CACHE[cache_key] = case_file
            cases.append(case_file)
        except Exception as e:
            print(f"Failed inspecting hotspot {hid}: {e}")

    return {
        "status": "success",
        "location_id": req.location_id,
        "cases": cases,
        "count": len(cases)
    }


@app.get("/api/inspection/{hotspot_id}")
async def get_cached_inspection(hotspot_id: str, location_id: str = "mihan", request: Request = None):
    """
    Retrieves the inspection case for a specific hotspot (from cache or newly executed).
    """
    cache_key = f"{location_id.lower()}_{hotspot_id.upper()}"
    if cache_key in INSPECTION_CACHE:
        return {"status": "success", "case": INSPECTION_CACHE[cache_key]}

    base_url = str(request.base_url).rstrip("/") if request else "http://localhost:8000"
    case_file = execute_zoom_and_verify_agent(hotspot_id=hotspot_id, location_id=location_id, base_url=base_url)
    INSPECTION_CACHE[cache_key] = case_file
    return {"status": "success", "case": case_file}


# ============================================================================
# YOLO Building Intelligence Endpoints
# ============================================================================

class YoloAnalyzeRequest(BaseModel):
    hotspot_id: str = Field("MIHAN-042", description="Hotspot identifier e.g. MIHAN-042, WARD-01, DHP-01")
    location_id: Optional[str] = Field(None, description="Optional parent location identifier e.g. mihan, hingna, sadar")
    before_image: Optional[str] = Field(None, description="Optional custom before image path/URL")
    after_image: Optional[str] = Field(None, description="Optional custom after image path/URL")
    conf_threshold: float = Field(0.35, description="YOLO confidence threshold (0.10 - 0.95)")


def _resolve_hotspot_image_paths(hotspot_id: str, location_id: Optional[str] = None, custom_before: Optional[str] = None, custom_after: Optional[str] = None) -> Tuple[Optional[Path], Optional[Path], Path]:
    """
    Dynamically finds or resolves before and after image paths for ANY hotspot or location.
    """
    hid_clean = hotspot_id.lower().replace("_", "-")
    crops_dir = STATIC_DIR / "hotspot_crops" / hid_clean

    # 1. Custom provided image paths
    if custom_before and custom_after:
        p_b = Path(custom_before.lstrip("/"))
        p_a = Path(custom_after.lstrip("/"))
        
        # Check relative to repo / public / static
        for candidate_root in [BASE_DIR, PUBLIC_DIR, STATIC_DIR]:
            cb = candidate_root / p_b
            ca = candidate_root / p_a
            if cb.exists() and ca.exists():
                return cb, ca, crops_dir

    # 2. Check exact hotspot crop folder
    if crops_dir.exists():
        b = next(crops_dir.glob("*_level1_before.png"), None) or next(crops_dir.glob("*before*.png"), None)
        a = next(crops_dir.glob("*_level1_after.png"), None) or next(crops_dir.glob("*after*.png"), None)
        if b and a:
            return b, a, crops_dir

    # 3. Fuzzy match to available hotspot crops
    all_crop_dirs = list((STATIC_DIR / "hotspot_crops").iterdir())
    for cd in all_crop_dirs:
        if cd.is_dir():
            prefix = hid_clean.split("-")[0]
            if cd.name.startswith(prefix) or prefix in cd.name:
                b = next(cd.glob("*_level1_before.png"), None) or next(cd.glob("*before*.png"), None)
                a = next(cd.glob("*_level1_after.png"), None) or next(cd.glob("*after*.png"), None)
                if b and a:
                    return b, a, cd

    # 4. Check preset Wayback images in public directory for known locations
    loc_key = (location_id or hid_clean).lower()
    if "hingna" in loc_key:
        b = PUBLIC_DIR / "wayback_hingna_2019_before.png"
        a = PUBLIC_DIR / "wayback_hingna_2025_after.png"
        if b.exists() and a.exists():
            return b, a, crops_dir
    elif "sadar" in loc_key:
        b = PUBLIC_DIR / "wayback_sadar_2019_before.png"
        a = PUBLIC_DIR / "wayback_sadar_2025_after.png"
        if b.exists() and a.exists():
            return b, a, crops_dir
    elif "civil" in loc_key:
        b = PUBLIC_DIR / "wayback_civil_lines_2019_before.png"
        a = PUBLIC_DIR / "wayback_civil_lines_2025_after.png"
        if b.exists() and a.exists():
            return b, a, crops_dir

    # 5. Default fallback to mihan-042
    default_dir = STATIC_DIR / "hotspot_crops" / "mihan-042"
    b = default_dir / "mihan-042_level1_before.png"
    a = default_dir / "mihan-042_level1_after.png"
    return b, a, default_dir


def _build_yolo_response_payload(
    hotspot_id: str,
    change_res: Dict[str, Any],
    veri_res: Optional[Dict[str, Any]] = None,
    fusion_res: Optional[Dict[str, Any]] = None,
    run_dir_name: str = "yolo_change_test",
    before_rel_url: str = "",
    after_rel_url: str = "",
    base_url: str = ""
) -> Dict[str, Any]:
    """Helper to construct standard YOLO building intelligence payload."""
    dev, dev_name = get_inference_device()
    s = change_res.get("summary", {})
    after_records = change_res.get("after_building_records", [])
    before_records = change_res.get("before_building_records", [])

    veri_map = {}
    if veri_res and "candidates" in veri_res:
        veri_map = {c["candidate_id"]: c for c in veri_res["candidates"]}

    case_map = {}
    if fusion_res and "cases" in fusion_res:
        case_map = {c["candidate_id"]: c for c in fusion_res["cases"]}

    enriched_detections = []
    confs = []
    for rec in after_records:
        cid = rec["building_id"]
        conf = rec.get("after_confidence", 0.0)
        confs.append(conf)

        v_data = veri_map.get(cid, {})
        c_data = case_map.get(cid, {})

        det_entry = {
            **rec,
            "verification_status": v_data.get("status", "EXISTING" if rec["status"] == "EXISTING" else "UNCERTAIN"),
            "verification_evidence_score": v_data.get("evidence_score", None),
            "verification_reason": v_data.get("reason", ""),
            "verification_pipeline": c_data.get("verification_pipeline", None),
            "scoring_breakdown": c_data.get("scoring_breakdown", None),
            "risk_score": c_data.get("risk_score", 0.0 if rec["status"] == "EXISTING" else 70.0),
            "priority": c_data.get("priority", "LOW" if rec["status"] == "EXISTING" else "HIGH"),
            "recommended_action": c_data.get("recommended_action", "NO_ACTION" if rec["status"] == "EXISTING" else "FIELD_INSPECTION"),
            "recommended_action_details": c_data.get("recommended_action_details", "Physical structure emergence cross-verified via satellite segmentation. Field verification recommended."),
            "evidence_factors": c_data.get("evidence_factors", [])
        }
        enriched_detections.append(det_entry)

    avg_conf = round(float(sum(confs) / len(confs)), 4) if confs else 0.0
    top_conf = round(float(max(confs)), 4) if confs else 0.0

    hid_clean = hotspot_id.lower().replace("_", "-")

    return {
        "status": "success",
        "hotspot_id": hotspot_id,
        "timestamp": time.time(),
        "model_info": {
            "model": "keremberke/yolov8s-building-segmentation",
            "task": "segment",
            "class_names": ["Building"],
            "classes": {0: "Building"},
            "device": dev,
            "device_name": dev_name,
            "cuda_available": torch.cuda.is_available(),
            "vram_gb": round(torch.cuda.get_device_properties(0).total_memory / (1024**3), 1) if torch.cuda.is_available() else None,
            "confidence_threshold": change_res.get("confidence_threshold", 0.35),
            "iou_match_threshold": change_res.get("iou_match_threshold", 0.35),
            "inference_time_ms": change_res.get("total_inference_and_matching_time_ms", 0.0)
        },
        "summary": {
            "before_count": s.get("total_before_detections", len(before_records)),
            "after_count": s.get("total_after_detections", len(after_records)),
            "existing_count": s.get("num_existing", 0),
            "new_count": s.get("num_new", 0),
            "expanded_count": s.get("num_expanded", 0),
            "uncertain_count": s.get("num_uncertain", 0),
            "before_pixel_area": s.get("before_building_pixel_area", 0),
            "after_pixel_area": s.get("after_building_pixel_area", 0),
            "total_change_pixel_area": s.get("total_change_pixel_area", 0),
            "ground_area_m2": s.get("ground_area_m2", None),
            "physical_change": (s.get("num_new", 0) + s.get("num_expanded", 0)) > 0,
            "average_yolo_confidence": avg_conf,
            "top_yolo_confidence": top_conf
        },
        "image_dimensions": change_res.get("image_dimensions", {"width": 560, "height": 560}),
        "detections": enriched_detections,
        "before_records": before_records,
        "cases": fusion_res.get("cases", []) if fusion_res else [],
        "image_urls": {
            "before_image": before_rel_url or f"/static/hotspot_crops/{hid_clean}/{hid_clean}_level1_before.png",
            "after_image": after_rel_url or f"/static/hotspot_crops/{hid_clean}/{hid_clean}_level1_after.png",
            "before_annotated": f"/outputs/{run_dir_name}/before_annotated.jpg",
            "after_annotated": f"/outputs/{run_dir_name}/after_annotated.jpg",
            "change_mask": f"/outputs/{run_dir_name}/change_mask.png",
            "before_after_comparison": f"/outputs/{run_dir_name}/before_after_comparison.jpg",
            "verification_summary": f"/outputs/{run_dir_name}/verification_summary.jpg",
            "priority_summary": f"/outputs/{run_dir_name}/priority_summary.jpg"
        }
    }


@app.get("/api/yolo/status")
async def get_yolo_status():
    """
    Returns the real runtime status, device hardware, and capabilities of the YOLO segmentation engine.
    """
    dev, dev_name = get_inference_device()
    vram = round(torch.cuda.get_device_properties(0).total_memory / (1024**3), 1) if torch.cuda.is_available() else None
    return {
        "status": "READY",
        "model": "keremberke/yolov8s-building-segmentation",
        "task": "segment",
        "class_names": ["Building"],
        "classes": {0: "Building"},
        "device": dev,
        "device_name": dev_name,
        "cuda_available": torch.cuda.is_available(),
        "vram_gb": vram,
        "default_confidence_threshold": 0.35,
        "supports_live_inference": True
    }


@app.get("/api/yolo/results/{hotspot_id}")
async def get_yolo_results(hotspot_id: str, location_id: Optional[str] = Query(None), request: Request = None):
    """
    Retrieves precomputed or cached YOLO building intelligence results for ANY hotspot.
    """
    hid_clean = hotspot_id.lower().replace("_", "-")
    cache_key = f"{hid_clean}_{location_id or ''}"

    if cache_key in YOLO_RESULTS_CACHE:
        return YOLO_RESULTS_CACHE[cache_key]

    # Check if a specific run exists for this hotspot in outputs/yolo_runs/{hid_clean}/
    run_dir = OUTPUTS_DIR / "yolo_runs" / hid_clean
    if run_dir.exists() and (run_dir / "results.json").exists():
        with open(run_dir / "results.json", "r", encoding="utf-8") as f:
            yolo_data = json.load(f)

        veri_data = None
        if (run_dir / "verification_results.json").exists():
            with open(run_dir / "verification_results.json", "r", encoding="utf-8") as f:
                veri_data = json.load(f)

        fusion_data = None
        if (run_dir / "case_records.json").exists():
            with open(run_dir / "case_records.json", "r", encoding="utf-8") as f:
                fusion_data = json.load(f)

        before_p, after_p, _ = _resolve_hotspot_image_paths(hotspot_id=hotspot_id, location_id=location_id)
        before_rel, after_rel = "", ""
        if before_p and before_p.exists():
            try:
                if "static" in str(before_p).lower():
                    before_rel = f"/static/{before_p.relative_to(STATIC_DIR).as_posix()}"
                    after_rel = f"/static/{after_p.relative_to(STATIC_DIR).as_posix()}"
                elif "public" in str(before_p).lower():
                    before_rel = f"/{before_p.relative_to(PUBLIC_DIR).as_posix()}"
                    after_rel = f"/{after_p.relative_to(PUBLIC_DIR).as_posix()}"
            except Exception:
                pass

        base_url = str(request.base_url).rstrip("/") if request else ""
        payload = _build_yolo_response_payload(
            hotspot_id=hotspot_id,
            change_res=yolo_data,
            veri_res=veri_data,
            fusion_res=fusion_data,
            run_dir_name=f"yolo_runs/{hid_clean}",
            before_rel_url=before_rel,
            after_rel_url=after_rel,
            base_url=base_url
        )
        YOLO_RESULTS_CACHE[cache_key] = payload
        return payload

    # If no precomputed run exists for this hotspot, compute live
    return await analyze_yolo_building_change(
        YoloAnalyzeRequest(hotspot_id=hotspot_id, location_id=location_id, conf_threshold=0.35),
        request=request
    )


@app.post("/api/yolo/analyze")
async def analyze_yolo_building_change(req: YoloAnalyzeRequest, request: Request = None):
    """
    Runs end-to-end real YOLO building segmentation + before/after matching + multi-scale verification
    for ANY specified hotspot or location.
    """
    hid_clean = req.hotspot_id.lower().replace("_", "-")
    before_p, after_p, crops_dir = _resolve_hotspot_image_paths(
        hotspot_id=req.hotspot_id,
        location_id=req.location_id,
        custom_before=req.before_image,
        custom_after=req.after_image
    )

    if not before_p or not after_p or not before_p.exists() or not after_p.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Matched high-resolution imagery not found for hotspot '{req.hotspot_id}'."
        )

    try:
        # Output directory dedicated to this hotspot
        run_dir_name = f"yolo_runs/{hid_clean}"
        out_yolo_dir = OUTPUTS_DIR / "yolo_runs" / hid_clean
        out_yolo_dir.mkdir(parents=True, exist_ok=True)

        # 1. Run YOLO building change comparison
        change_res = compare_building_change(
            before_image=before_p,
            after_image=after_p,
            conf_threshold=req.conf_threshold,
            output_dir=out_yolo_dir
        )

        # 2. Run multi-scale optical verification on candidates
        veri_res = run_multiscale_verification(
            results_json_path=out_yolo_dir / "results.json",
            crops_dir=crops_dir,
            output_dir=out_yolo_dir,
            before_image_path=before_p,
            after_image_path=after_p
        )

        # 3. Fuse municipal inspection priorities
        fusion_res = fuse_municipal_evidence(
            yolo_results_path=out_yolo_dir / "results.json",
            multiscale_results_path=out_yolo_dir / "verification_results.json",
            hotspot_id=req.hotspot_id,
            output_dir=out_yolo_dir
        )

        # Construct relative URLs for before/after images
        before_rel = ""
        after_rel = ""
        try:
            if "static" in str(before_p).lower():
                before_rel = f"/static/{before_p.relative_to(STATIC_DIR).as_posix()}"
                after_rel = f"/static/{after_p.relative_to(STATIC_DIR).as_posix()}"
            elif "public" in str(before_p).lower():
                before_rel = f"/{before_p.relative_to(PUBLIC_DIR).as_posix()}"
                after_rel = f"/{after_p.relative_to(PUBLIC_DIR).as_posix()}"
        except Exception:
            pass

        base_url = str(request.base_url).rstrip("/") if request else ""
        payload = _build_yolo_response_payload(
            hotspot_id=req.hotspot_id,
            change_res=change_res,
            veri_res=veri_res,
            fusion_res=fusion_res,
            run_dir_name=run_dir_name,
            before_rel_url=before_rel,
            after_rel_url=after_rel,
            base_url=base_url
        )

        cache_key = hid_clean
        YOLO_RESULTS_CACHE[cache_key] = payload
        return payload

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"YOLO Building Analysis failed: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)

