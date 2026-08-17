import os
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .config import STATIC_DIR
from .geocoding import geocode_location
from .pipeline import run_analysis_pipeline, get_available_scene_dates, build_bbox_from_point
from .locations_data import PRESET_LOCATIONS
from .hotspots import get_hotspots_for_location
from .vision_inspector import execute_zoom_and_verify_agent

app = FastAPI(
    title="Nagpur EarthWatch API",
    description="Municipal Earth Observation & AI Zoom-and-Verify Urban Change Intelligence API",
    version="2.0.0"
)

# Enable CORS for local Vite development & staging
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for served result imagery
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# In-memory inspection cache for fast subsequent retrieval
INSPECTION_CACHE: Dict[str, Dict[str, Any]] = {}


class AnalyzeRequest(BaseModel):
    location_name: Optional[str] = Field(None, description="Location name or landmark to analyze")
    lat: Optional[float] = Field(None, description="Latitude")
    lng: Optional[float] = Field(None, description="Longitude")
    before_date: Optional[str] = Field(None, description="Explicit baseline scene date (YYYY-MM-DD)")
    after_date: Optional[str] = Field(None, description="Explicit comparison scene date (YYYY-MM-DD)")


class InspectHotspotRequest(BaseModel):
    hotspot_id: str = Field(..., description="Hotspot identifier (e.g. MIHAN-042)")
    location_id: Optional[str] = Field("mihan", description="Location ID")
    bbox: Optional[List[float]] = Field(None, description="[west, south, east, north] bounding box")
    before_date: Optional[str] = Field(None, description="Baseline date (e.g. 2019-01-31)")
    after_date: Optional[str] = Field(None, description="Comparison date (e.g. 2025-01-30)")


class InspectAllRequest(BaseModel):
    location_id: str = Field("mihan", description="Location ID to inspect all candidate hotspots for")


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "nagpur-earthwatch-backend", "version": "2.0.0"}


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
            # Default to Nagpur center
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


@app.post("/api/analyze")
async def analyze_location(req: AnalyzeRequest, request: Request):
    """
    Geocodes location -> Checks CDSE Sentinel-2 Catalog (<15% cloud cover) OR uses explicit date pair ->
    Fetches before/after 10m L2A imagery -> Runs optical color diff + SSIM ->
    Generates overlay PNGs and returns metrics.
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

    # Base URL for static assets
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
    2. Generates geographically aligned 0.6m Wayback crops (Level 1, 2, 3)
    3. Runs AI Vision inspection and change categorization
    4. Fuses 4-tier confidence scores
    5. Formulates the complete Government Inspection Case
    """
    cache_key = f"{req.location_id.lower()}_{req.hotspot_id.upper()}"
    base_url = str(request.base_url).rstrip("/")

    try:
        case_file = execute_zoom_and_verify_agent(
            hotspot_id=req.hotspot_id,
            location_id=req.location_id,
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
        hid = h["hotspot_id"]
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
