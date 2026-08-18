import os
from pathlib import Path
from typing import Dict, Any, Optional, List
from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from fastapi.responses import StreamingResponse
import json

from .config import STATIC_DIR
from .locations_data import PRESET_LOCATIONS
from .geocoding import geocode_location
from .pipeline import (
    run_analysis_pipeline,
    get_available_scene_dates,
    build_bbox_from_point
)
from .hotspots import get_hotspots_for_location
from .vision_inspector import execute_zoom_and_verify_agent
from .wayback_live import check_wayback_availability
from .agent.orchestrator import EarthWatchOrchestrator, run_earthwatch_agent
from .narrate import generate_narrative


class NarrateRequest(BaseModel):
    location_name: str = Field("MIHAN / SEZ", description="Display name of the location")
    before_date: str = Field("2019-01-31", description="Baseline date YYYY-MM-DD")
    after_date: str = Field("2025-01-30", description="Current date YYYY-MM-DD")
    infra_pct: float = Field(0.0, description="Infrastructure/construction delta %")
    veg_loss_pct: float = Field(0.0, description="Vegetation/canopy loss %")
    veg_gain_pct: float = Field(0.0, description="Afforestation/veg gain %")
    ssim_score: float = Field(0.85, description="SSIM structural index (0-1)")
    ssim_pct: float = Field(0.0, description="SSIM structural divergence %")
    tier: str = Field("0.6m", description="Active sensor tier: '0.6m' or '10m'")
    hotspot_count: int = Field(0, description="Number of flagged hotspots")
    hotspot_types: List[str] = Field(default_factory=list, description="List of change typology labels")
    is_stable: bool = Field(False, description="Whether the location is surface-stable")


class AgentRunRequest(BaseModel):
    location_name: str = Field(..., description="Any searchable location or landmark in Nagpur (e.g. Civil Lines, Sadar, Hingna MIDC, MIHAN, Sitabuldi)")
    before_date: Optional[str] = Field(None, description="Optional baseline date YYYY-MM-DD")
    after_date: Optional[str] = Field(None, description="Optional current date YYYY-MM-DD")

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

# In-memory inspection cache
INSPECTION_CACHE: Dict[str, Dict[str, Any]] = {}


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


@app.post("/api/narrate")
async def narrate_analysis(req: NarrateRequest):
    """
    Generates a natural-language satellite change narrative using Gemini Flash 2.0.
    Returns:
      - analysis:   Plain-language description of what changed
      - prediction: Projection of what is likely to happen next 12-24 months
      - confidence: HIGH | MEDIUM | LOW
      - tags:       Short change-type labels
    Falls back to rule-based NLP summary if GEMINI_API_KEY is not set.
    """
    result = generate_narrative(
        location_name=req.location_name,
        before_date=req.before_date,
        after_date=req.after_date,
        infra_pct=req.infra_pct,
        veg_loss_pct=req.veg_loss_pct,
        veg_gain_pct=req.veg_gain_pct,
        ssim_score=req.ssim_score,
        ssim_pct=req.ssim_pct,
        tier=req.tier,
        hotspot_count=req.hotspot_count,
        hotspot_types=req.hotspot_types,
        is_stable=req.is_stable,
    )
    return {"status": "ok", **result}


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


# ==========================================
# CENTRAL AGENTIC ORCHESTRATION ENDPOINTS
# ==========================================

@app.post("/api/agent/run")
async def run_agent_investigation(req: AgentRunRequest, request: Request):
    """
    Executes the full autonomous EarthWatch Agent workflow:
    SEARCH -> PLAN -> SCAN -> REASON -> ZOOM -> VERIFY -> CROSS-CHECK -> REPORT
    """
    base_url = str(request.base_url).rstrip("/")
    orchestrator = EarthWatchOrchestrator(base_url=base_url)

    try:
        result = await orchestrator.execute_investigation(
            location_query=req.location_name,
            custom_before=req.before_date,
            custom_after=req.after_date
        )
        return result
    except ValueError as ve:
        raise HTTPException(
            status_code=422,
            detail={"status": "error", "reason": str(ve)}
        )
    except Exception as e:
        print(f"EarthWatch Agent error on '{req.location_name}': {e}")
        raise HTTPException(
            status_code=500,
            detail={"status": "error", "reason": f"Agent investigation failed: {str(e)}"}
        )


@app.get("/api/agent/stream")
async def stream_agent_investigation(
    location_name: str = Query(..., description="Location to investigate"),
    before_date: Optional[str] = Query(None),
    after_date: Optional[str] = Query(None),
    request: Request = None
):
    """
    Streams real-time step-by-step tool execution events as Server-Sent Events (SSE).
    """
    base_url = str(request.base_url).rstrip("/") if request else "http://localhost:8000"

    async def event_generator():
        orchestrator = EarthWatchOrchestrator(base_url=base_url)
        queue: asyncio.Queue = asyncio.Queue()

        def on_event(evt):
            queue.put_nowait(evt)

        # Launch orchestrator in background task
        task = asyncio.create_task(
            orchestrator.execute_investigation(
                location_query=location_name,
                custom_before=before_date,
                custom_after=after_date,
                event_callback=on_event
            )
        )

        while not task.done() or not queue.empty():
            try:
                evt = await asyncio.wait_for(queue.get(), timeout=0.2)
                yield f"data: {json.dumps(evt)}\n\n"
            except asyncio.TimeoutError:
                continue

        try:
            final_res = await task
            yield f"data: {json.dumps({'type': 'COMPLETE', 'result': final_res})}\n\n"
        except Exception as err:
            yield f"data: {json.dumps({'type': 'ERROR', 'error': str(err)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
