import os
from typing import Optional
from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .config import STATIC_DIR
from .geocoding import geocode_location
from .pipeline import run_analysis_pipeline, get_available_scene_dates, build_bbox_from_point
from .locations_data import PRESET_LOCATIONS

app = FastAPI(
    title="Nagpur EarthWatch API",
    description="Municipal Earth Observation & Urban Change Intelligence API",
    version="1.0.0"
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

class AnalyzeRequest(BaseModel):
    location_name: Optional[str] = Field(None, description="Location name or landmark to analyze")
    lat: Optional[float] = Field(None, description="Latitude")
    lng: Optional[float] = Field(None, description="Longitude")
    before_date: Optional[str] = Field(None, description="Explicit baseline scene date (YYYY-MM-DD)")
    after_date: Optional[str] = Field(None, description="Explicit comparison scene date (YYYY-MM-DD)")

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "nagpur-earthwatch-backend"}

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
        # Cloud cover or date window validation failure
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
