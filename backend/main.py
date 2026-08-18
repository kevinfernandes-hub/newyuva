import os
import json
import time
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
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

# Mount static files directory for serving satellite imagery & overlays
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
app.mount("/outputs", StaticFiles(directory=str(OUTPUTS_DIR)), name="outputs")
if PUBLIC_DIR.exists():
    app.mount("/public", StaticFiles(directory=str(PUBLIC_DIR)), name="public")

# In-memory inspection cache
INSPECTION_CACHE: Dict[str, Dict[str, Any]] = {}
YOLO_RESULTS_CACHE: Dict[str, Dict[str, Any]] = {}


# Pydantic Schemas
class AnalyzeRequest(BaseModel):
    location_name: Optional[str] = Field(None, description="Location name or landmark in Nagpur")
    lat: Optional[float] = Field(None, description="Latitude coordinate")
    lng: Optional[float] = Field(None, description="Longitude coordinate")
    before_date: Optional[str] = Field(None, description="Baseline date YYYY-MM-DD")
    after_date: Optional[str] = Field(None, description="Current date YYYY-MM-DD")


class InspectHotspotRequest(BaseModel):
    hotspot_id: str = Field("MIHAN-042", description="Hotspot identifier")
    location_id: str = Field("mihan", description="Location identifier")
    hotspot_data: Optional[Dict[str, Any]] = Field(None, description="Complete candidate hotspot metadata")


class InspectAllRequest(BaseModel):
    location_id: str = Field("mihan", description="Location identifier")


class YoloAnalyzeRequest(BaseModel):
    hotspot_id: str = Field("MIHAN-042", description="Hotspot identifier e.g. MIHAN-042, WARD-01, DHP-01")
    location_id: Optional[str] = Field(None, description="Optional parent location identifier")
    before_image: Optional[str] = Field(None, description="Optional custom before image path/URL")
    after_image: Optional[str] = Field(None, description="Optional custom after image path/URL")
    conf_threshold: float = Field(0.35, description="YOLO confidence threshold (0.10 - 0.95)")


# Base Endpoints
@app.get("/")
async def root_index():
    return {
        "status": "online",
        "service": "Nagpur EarthWatch Universal Intelligence API",
        "version": "2.0.0",
        "documentation": "/docs",
        "health": "/api/health"
    }


@app.get("/favicon.ico")
async def favicon():
    return JSONResponse(status_code=204, content={})


@app.get("/.well-known/{path:path}")
async def well_known_fallback(path: str):
    return JSONResponse(status_code=204, content={})


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
    bbox = [lng - padding, lat - padding, lng + padding, lat + padding]
    return check_wayback_availability(bbox)


@app.api_route("/api/analyze", methods=["GET", "POST"])
async def analyze_location(
    request: Request,
    location_name: Optional[str] = Query(None),
    lat: Optional[float] = Query(None),
    lng: Optional[float] = Query(None),
    before_date: Optional[str] = Query(None),
    after_date: Optional[str] = Query(None)
):
    """
    Universal Location Analysis Endpoint: Supports both GET and POST requests.
    """
    body_data = {}
    if request.method == "POST":
        try:
            body_data = await request.json()
        except Exception:
            pass

    loc_name = body_data.get("location_name") or location_name
    latitude = body_data.get("lat") if body_data.get("lat") is not None else lat
    longitude = body_data.get("lng") if body_data.get("lng") is not None else lng
    b_date = body_data.get("before_date") or before_date
    a_date = body_data.get("after_date") or after_date

    if not loc_name and (latitude is None or longitude is None):
        loc_name = "MIHAN / Outer Ring Road"

    if loc_name:
        lat_val, lng_val, display_name = await geocode_location(loc_name)
    else:
        lat_val, lng_val = latitude, longitude
        display_name = f"Custom AOI ({lat_val:.4f}° N, {lng_val:.4f}° E)"

    base_url = str(request.base_url).rstrip("/")

    try:
        result = run_analysis_pipeline(
            lat=lat_val,
            lng=lng_val,
            location_name=display_name,
            before_date=b_date,
            after_date=a_date,
            base_url=base_url
        )
        return result
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
    hotspots = get_hotspots_for_location(location_id)
    return {
        "location_id": location_id,
        "hotspots": hotspots,
        "count": len(hotspots),
        "high_priority_count": sum(1 for h in hotspots if h.get("priority") in ["CRITICAL", "HIGH"])
    }


@app.api_route("/api/inspect-hotspot", methods=["GET", "POST"])
async def inspect_hotspot(
    request: Request,
    hotspot_id: Optional[str] = Query(None),
    location_id: Optional[str] = Query("mihan")
):
    """
    Executes the AI Zoom-and-Verify Agent on a specific candidate hotspot (Supports GET & POST).
    """
    body_data = {}
    if request.method == "POST":
        try:
            body_data = await request.json()
        except Exception:
            pass

    hid = body_data.get("hotspot_id") or hotspot_id or "MIHAN-042"
    loc_id = body_data.get("location_id") or location_id or "mihan"
    hdata = body_data.get("hotspot_data")

    cache_key = f"{loc_id.lower()}_{hid.upper()}"
    base_url = str(request.base_url).rstrip("/")

    try:
        case_file = execute_zoom_and_verify_agent(
            hotspot_id=hid,
            location_id=loc_id,
            hotspot_data=hdata,
            base_url=base_url
        )
        INSPECTION_CACHE[cache_key] = case_file
        return {
            "status": "success",
            "case": case_file
        }
    except Exception as e:
        print(f"Inspection agent error for {hid}: {e}")
        raise HTTPException(
            status_code=500,
            detail={"status": "error", "reason": f"Inspection failed: {str(e)}"}
        )


@app.api_route("/api/inspect-all", methods=["GET", "POST"])
async def inspect_all_hotspots(
    request: Request,
    location_id: Optional[str] = Query("mihan")
):
    body_data = {}
    if request.method == "POST":
        try:
            body_data = await request.json()
        except Exception:
            pass

    loc_id = body_data.get("location_id") or location_id or "mihan"
    base_url = str(request.base_url).rstrip("/")
    hotspots = get_hotspots_for_location(loc_id)
    cases = []

    for h in hotspots:
        hid = h.get("hotspot_id", "")
        if not hid:
            continue
        try:
            case_file = execute_zoom_and_verify_agent(
                hotspot_id=hid,
                location_id=loc_id,
                base_url=base_url
            )
            cache_key = f"{loc_id.lower()}_{hid.upper()}"
            INSPECTION_CACHE[cache_key] = case_file
            cases.append(case_file)
        except Exception as e:
            print(f"Failed inspecting hotspot {hid}: {e}")

    return {
        "status": "success",
        "location_id": loc_id,
        "cases": cases,
        "count": len(cases)
    }


@app.api_route("/api/inspection/{hotspot_id}", methods=["GET", "POST"])
async def get_cached_inspection(hotspot_id: str, location_id: str = "mihan", request: Request = None):
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

def _resolve_hotspot_image_paths(hotspot_id: str, location_id: Optional[str] = None, custom_before: Optional[str] = None, custom_after: Optional[str] = None) -> Tuple[Optional[Path], Optional[Path], Path]:
    hid_clean = hotspot_id.lower().replace("_", "-")
    crops_dir = STATIC_DIR / "hotspot_crops" / hid_clean

    if custom_before and custom_after:
        p_b = Path(custom_before.lstrip("/"))
        p_a = Path(custom_after.lstrip("/"))
        for candidate_root in [BASE_DIR, PUBLIC_DIR, STATIC_DIR]:
            cb = candidate_root / p_b
            ca = candidate_root / p_a
            if cb.exists() and ca.exists():
                return cb, ca, crops_dir

    if crops_dir.exists():
        b = next(crops_dir.glob("*_level1_before.png"), None) or next(crops_dir.glob("*before*.png"), None)
        a = next(crops_dir.glob("*_level1_after.png"), None) or next(crops_dir.glob("*after*.png"), None)
        if b and a:
            return b, a, crops_dir

    all_crop_dirs = list((STATIC_DIR / "hotspot_crops").iterdir())
    for cd in all_crop_dirs:
        if cd.is_dir():
            prefix = hid_clean.split("-")[0]
            if cd.name.startswith(prefix) or prefix in cd.name:
                b = next(cd.glob("*_level1_before.png"), None) or next(cd.glob("*before*.png"), None)
                a = next(cd.glob("*_level1_after.png"), None) or next(cd.glob("*after*.png"), None)
                if b and a:
                    return b, a, cd

    if not isinstance(location_id, str):
        location_id = None
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


@app.api_route("/api/yolo/results/{hotspot_id}", methods=["GET", "POST"])
async def get_yolo_results(hotspot_id: str, location_id: Optional[str] = Query(None), request: Request = None):
    loc_id_str = location_id if isinstance(location_id, str) else None
    hid_clean = hotspot_id.lower().replace("_", "-")
    cache_key = f"{hid_clean}_{loc_id_str or ''}"

    if cache_key in YOLO_RESULTS_CACHE:
        return YOLO_RESULTS_CACHE[cache_key]

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

    return await analyze_yolo_building_change(
        request=request,
        hotspot_id=hotspot_id,
        location_id=loc_id_str
    )


@app.api_route("/api/yolo/analyze", methods=["GET", "POST"])
async def analyze_yolo_building_change(
    request: Request,
    hotspot_id: Optional[str] = Query(None),
    location_id: Optional[str] = Query(None),
    conf_threshold: float = Query(0.35)
):
    body_data = {}
    if request.method == "POST":
        try:
            body_data = await request.json()
        except Exception:
            pass

    hid = body_data.get("hotspot_id") or hotspot_id or "MIHAN-042"
    loc_id = body_data.get("location_id") or location_id
    conf = float(body_data.get("conf_threshold") or conf_threshold or 0.35)
    custom_b = body_data.get("before_image")
    custom_a = body_data.get("after_image")

    hid_clean = hid.lower().replace("_", "-")
    before_p, after_p, crops_dir = _resolve_hotspot_image_paths(
        hotspot_id=hid,
        location_id=loc_id,
        custom_before=custom_b,
        custom_after=custom_a
    )

    if not before_p or not after_p or not before_p.exists() or not after_p.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Matched high-resolution imagery not found for hotspot '{hid}'."
        )

    try:
        run_dir_name = f"yolo_runs/{hid_clean}"
        out_yolo_dir = OUTPUTS_DIR / "yolo_runs" / hid_clean
        out_yolo_dir.mkdir(parents=True, exist_ok=True)

        change_res = compare_building_change(
            before_image=before_p,
            after_image=after_p,
            conf_threshold=conf,
            output_dir=out_yolo_dir
        )

        veri_res = run_multiscale_verification(
            results_json_path=out_yolo_dir / "results.json",
            crops_dir=crops_dir,
            output_dir=out_yolo_dir,
            before_image_path=before_p,
            after_image_path=after_p
        )

        fusion_res = fuse_municipal_evidence(
            yolo_results_path=out_yolo_dir / "results.json",
            multiscale_results_path=out_yolo_dir / "verification_results.json",
            hotspot_id=hid,
            output_dir=out_yolo_dir
        )

        before_rel, after_rel = "", ""
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
            hotspot_id=hid,
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


# -----------------------------------------------------------------------------
# Phase 5: Adaptive Municipal Priority, XGBoost & Gemini Explanation Endpoints
# -----------------------------------------------------------------------------
from backend.priority_engine import evaluate_rule_priority
from backend.priority_xgboost import evaluate_xgboost_priority
from backend.explanation_engine import generate_officer_explanation
from backend.priority_training import save_officer_feedback, load_all_feedback


@app.api_route("/api/priority/evaluate", methods=["GET", "POST"])
async def evaluate_municipal_priority(request: Request, case_id: Optional[str] = Query(None)):
    """
    Evaluates rule-based priority score, checks XGBoost adaptive model,
    and generates Gemini/Grok officer explanation with deterministic fallback (Supports GET & POST).
    """
    body_data = {}
    if request.method == "POST":
        try:
            body_data = await request.json()
        except Exception:
            pass

    cid = body_data.get("case_id") or case_id or "CASE #NGP-MIHAN-BLDG-001"
    cd = body_data.get("case_data") or {"case_id": cid}
    yolo_res = body_data.get("yolo_results")
    veri_res = body_data.get("verification_results")

    rule_res = evaluate_rule_priority(cd, yolo_res, veri_res)
    xgb_res = evaluate_xgboost_priority(rule_res.get("features", {}))
    explanation = generate_officer_explanation(cd, rule_res)

    return {
        "case_id": cid,
        "rule_based_priority": rule_res,
        "xgboost_model": xgb_res,
        "explanation": explanation,
        "active_priority": rule_res["priority"] if xgb_res.get("fallback_to_rules") else xgb_res["prediction"]
    }


@app.api_route("/api/priority/feedback", methods=["GET", "POST"])
async def submit_officer_feedback(
    request: Request,
    case_id: Optional[str] = Query(None),
    officer_decision: Optional[str] = Query(None),
    officer_priority: Optional[str] = Query(None),
    notes: Optional[str] = Query(None)
):
    """
    Logs officer review decisions and priorities as ground-truth training data (Supports GET & POST).
    """
    body_data = {}
    if request.method == "POST":
        try:
            body_data = await request.json()
        except Exception:
            pass

    cid = body_data.get("case_id") or case_id or "CASE #NGP-MIHAN-BLDG-001"
    dec = body_data.get("officer_decision") or officer_decision or "CONFIRMED"
    prio = body_data.get("officer_priority") or officer_priority or "HIGH"
    nts = body_data.get("notes") or notes or ""
    cd = body_data.get("case_data")

    res = save_officer_feedback(
        case_id=cid,
        officer_decision=dec,
        officer_priority=prio,
        notes=nts,
        case_data=cd
    )
    return res


@app.get("/api/priority/model-status")
def get_priority_model_status():
    all_fb = load_all_feedback()
    dummy_feats = {
        "change_pixel_area": 1812.0, "change_pct": 7.06, "new_buildings_count": 1,
        "expanded_buildings_count": 0, "yolo_confidence": 0.68, "verification_score": 71.0,
        "iou": 0.0, "ssim_divergence": 90.6, "edge_emergence": 17.5, "time_delta_days": 2191,
        "change_type_code": 1, "sensitivity_score": 80.0, "image_quality_code": 1
    }
    xgb_info = evaluate_xgboost_priority(dummy_feats)
    return {
        "total_officer_feedback_count": len(all_fb),
        "xgboost_status": xgb_info
    }


# Static Image File Fallbacks for root asset requests
@app.get("/{filename}.png")
async def get_public_png(filename: str):
    file_path = PUBLIC_DIR / f"{filename}.png"
    if file_path.exists():
        return FileResponse(file_path)
    static_file = STATIC_DIR / f"{filename}.png"
    if static_file.exists():
        return FileResponse(static_file)
    raise HTTPException(status_code=404, detail=f"PNG asset '{filename}.png' not found")


@app.get("/{filename}.jpg")
async def get_public_jpg(filename: str):
    file_path = PUBLIC_DIR / f"{filename}.jpg"
    if file_path.exists():
        return FileResponse(file_path)
    static_file = STATIC_DIR / f"{filename}.jpg"
    if static_file.exists():
        return FileResponse(static_file)
    raise HTTPException(status_code=404, detail=f"JPG asset '{filename}.jpg' not found")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
