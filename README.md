# 🛰️ Nagpur EarthWatch — Dual-Tier Urban Change Intelligence

An automated satellite remote sensing and AI-powered municipal intelligence platform for detecting, classifying, and verifying urban expansion, illegal encroachments, and land-use transitions across Nagpur, Maharashtra.

---

## 📌 Executive Summary

Nagpur EarthWatch combines **10m Copernicus Sentinel-2 multispectral imagery** with **~0.6m Maxar / Esri Wayback ultra-high-resolution historical mosaics** in a **coarse-to-fine dual-tier architecture**. 

By coupling multi-temporal optical differencing and structural similarity (SSIM) matrices with an autonomous **AI Zoom-and-Verify Agent**, the system pinpoints unauthorized developments, generates multi-scale visual evidence dossiers, and cross-references municipal permit registries for municipal enforcement.

```
+-------------------------------------------------------------------------------------------------+
|                                 NAGPUR EARTHWATCH ARCHITECTURE                                  |
|                                                                                                 |
|  [ Copernicus CDSE ]           [ Esri Wayback WMTS ]         [ OSM / Municipal Registry ]       |
|    Sentinel-2 L2A                Maxar 0.6m Mosaics            Geocoding & Permit Data          |
|          │                               │                               │                      |
|          ▼                               ▼                               ▼                      |
|   ┌──────────────┐              ┌──────────────────┐            ┌──────────────────┐            |
|   │ TIER 1 (10m) │ ──Hotspots─► │  TIER 2 (0.6m)   │ ──Crops──► │ AI INSPECTION    │            |
|   │  Macro Scan  │              │ Micro Alignment  │            │  & FUSED DOSSIER │            |
|   └──────────────┘              └──────────────────┘            └──────────────────┘            |
|     • SSIM & Pixel Deltas         • Scale-matched Kernels         • 4-Tier Zoom Inspection      |
|     • Dynamic World LULC          • Sub-meter Unsharp Mask        • Typology Classification     |
|     • Spatial Contours            • Radiometric Differencing      • Composite Confidence        |
+-------------------------------------------------------------------------------------------------+
```

---

## ✨ Key Features

### 1. Dual-Tier Resolution Pipeline
- **Tier 1: Macro Surveillance (10m Resolution)**:
  - Multi-temporal Sentinel-2 L2A granules queried via Copernicus Data Space Ecosystem (CDSE).
  - Pixel-level color deltas + Structural Similarity Index Measure (SSIM) matrices.
  - Dynamic World land-use land-cover (LULC) transition analysis (e.g., *Crops/Scrub → Built*).
  - Automated contour extraction and geographical bounding box mapping.
- **Tier 2: Micro Verification (~0.6m Sub-Meter Resolution)**:
  - On-demand concurrent tile fetching from Esri Wayback historical archives.
  - Scale-matched morphological filtering (7×7 kernel / ~4.2m footprint) to eliminate sub-meter texture noise.
  - Edge-enhanced unsharp masking for crisp building envelope delineations.

### 2. Autonomous AI Zoom-and-Verify Agent
- **7-Stage Coarse-to-Fine Verification**:
  1. Candidate hotspot flagged at 10m resolution.
  2. Multi-temporal 0.6m imagery acquired and cached.
  3. Geo-referenced sub-pixel alignment and cropping.
  4. Multi-scale zoom inspection:
     - **Level 1**: Hotspot Overview (~500m × 500m)
     - **Level 2**: Sub-Region Footprint (~100m × 100m)
     - **Level 3**: Building Envelope (~30m × 30m)
     - **Level 4**: Micro-Inspection (~15m × 15m)
  5. AI Vision Typology Classification (`NEW_CONSTRUCTION`, `ROAD_DEVELOPMENT`, `VEGETATION_LOSS`, `INDUSTRIAL_EXPANSION`, `WATERBODY_CHANGE`, `DEMOLITION`).
  6. **EarthWatch Composite Confidence Scoring**:
     $$\text{Confidence} = 0.25(\text{10m}) + 0.35(\text{0.6m}) + 0.30(\text{AI Vision}) + 0.10(\text{Spatial Consistency})$$
  7. Government Case Dossier Generation with municipal permit audit flags (`MATCHED`, `UNMATCHED`, `NO RECORD FOUND`).

### 3. Interactive Web Dashboard
- **Split-Screen & Swipe Comparison**: Real-time slider, opacity blending, difference masks, and side-by-side comparative views.
- **Timeline & Date Selector**: Query arbitrary historical scene dates with automated cloud-cover filtering (<15%).
- **Interactive Leaflet Map**: Spatial boundary outlines, sector bounding boxes, and hotspot markers.
- **Dynamic Sensitivity Calibration**: Real-time calibration curve adjustments to tune false-positive rejection.
- **Live Search & Geocoding**: Search any address, landmark, or custom coordinate pair in Nagpur via OpenStreetMap Nominatim.

---

## 🏛️ Preset Municipal Sectors

| Sector / Corridor | Zone / Description | Baseline Period | Primary Growth Pattern |
| :--- | :--- | :--- | :--- |
| **MIHAN / Outer Ring Road** | South Ward IX — Aerospace & SEZ Corridor | 2019 → 2025 | Large-scale institutional & logistics expansion |
| **Manish Nagar & Besa-Pipla** | South-East Urban Expansion Fringe | 2020 → 2024 | Dense residential plotted developments |
| **Sadar & Civil Lines** | Central Administrative Ward II | 2021 → 2024 | Commercial infill & civic infrastructure |
| **Hingna Industrial Zone** | MIDC South-West Industrial Belt | 2020 → 2024 | Heavy manufacturing & warehouse expansion |
| **Gittikhadan Quarry Zone** | North-West Mining & Reclamation Ring | 2020 → 2024 | Extraction pit shifts & perimeter encroachment |

---

## 🛠️ Technology Stack

- **Backend**:
  - **Framework**: Python 3.13 / 3.9+, [FastAPI](https://fastapi.tiangolo.com/), [Uvicorn](https://www.uvicorn.org/)
  - **Satellite & GIS**: [Sentinel Hub Python SDK](https://github.com/sentinel-hub/sentinelhub-py) (`sentinelhub`), [Copernicus CDSE API](https://dataspace.copernicus.eu/), [Esri Wayback WMTS](https://livingatlas.arcgis.com/wayback/)
  - **Computer Vision & Image Processing**: OpenCV (`cv2`), [scikit-image](https://scikit-image.org/) (`ssim`), NumPy, Pillow
  - **Validation & Environment**: Pydantic v2, `python-dotenv`
- **Frontend**:
  - **Core**: React 18, Vite
  - **Mapping & Visualization**: Leaflet, React-Leaflet
  - **Styling**: CSS Modules with modern dark glassmorphism design tokens

---

## 🚀 Getting Started

### 1. Prerequisites
- **Python**: `3.9+` (Tested on `3.13`)
- **Node.js**: `v18+` and `npm`
- **Copernicus CDSE Account** (for live Sentinel-2 queries): Register at [dataspace.copernicus.eu](https://dataspace.copernicus.eu/)

### 2. Environment Setup
Create a `.env` file in the root directory:
```env
# Copernicus Data Space Ecosystem (CDSE) Credentials
SH_CLIENT_ID=your_cdse_client_id_here
SH_CLIENT_SECRET=your_cdse_client_secret_here
```

### 3. Backend Setup & Run
```bash
# Install Python dependencies (if using a virtual environment)
pip install fastapi uvicorn sentinelhub opencv-python scikit-image pillow numpy python-dotenv pydantic requests

# Start the FastAPI backend server
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

### 4. Frontend Setup & Run
```bash
# Install Node dependencies
npm install

# Start the Vite development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. The Vite dev server automatically proxies `/api` and `/static` requests to the FastAPI backend on port `8000`.

---

## 🔌 API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/locations` | List all preset sectors with precomputed metrics and overlay paths. |
| `GET` | `/api/hotspots?location_id={id}` | Retrieve prioritized spatial change hotspots for a sector. |
| `POST` | `/api/analyze` | Run on-demand Sentinel-2 + Wayback analysis for arbitrary coordinates or location names. |
| `POST` | `/api/inspect-hotspot` | Trigger the AI Zoom-and-Verify Agent on a specific hotspot. |
| `GET` | `/api/scene-dates?lat={lat}&lng={lng}` | Query cloud-free Sentinel-2 acquisition dates. |
| `GET` | `/api/health` | Health check endpoint. |

---

## 📁 Repository Structure

```
Nagpur_X/
├── backend/                  # FastAPI backend service
│   ├── main.py               # REST API endpoints & CORS/static mounting
│   ├── pipeline.py           # Sentinel-2 acquisition, differencing & SSIM pipeline
│   ├── wayback_live.py       # Esri Wayback 0.6m WMTS concurrent tile engine
│   ├── wayback_crop.py       # High-res sub-meter alignment & geo-cropping
│   ├── hotspots.py           # Contour extraction & spatial hotspot ranking
│   ├── vision_inspector.py   # Multi-tier AI vision agent & confidence fusion
│   ├── locations_data.py     # Sector metadata, presets & permit tables
│   ├── geocoding.py          # Nominatim geocoding & spatial caching
│   └── config.py             # CDSE authentication & path resolution
├── src/                      # React frontend application
│   ├── components/           # UI modules (Viewer, Map, Hotspots, Modals, Calibration)
│   ├── data/                 # Bundled fallback sector & calibration curves
│   ├── hooks/                # Custom React hooks (e.g. useDraggable)
│   ├── styles/               # Global CSS tokens & resets
│   ├── App.jsx               # Main state orchestration & dashboard workspace
│   └── main.jsx              # React root entrypoint
├── public/                   # Static icons & fallback demonstration assets
├── package.json              # Frontend dependencies & scripts
├── pyproject.toml            # Python tooling & type configuration
├── pyrefly.toml              # Pyrefly language server configuration
└── pyrightconfig.json        # Pyright configuration for Windows
```

---

## 📄 License
Internal Municipal & Academic Research Project — Developed for Urban Intelligence & Automated Remote Sensing Audits.