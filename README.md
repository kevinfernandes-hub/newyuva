# 🛰️ NMC EarthWatch — AI-Powered Municipal Decision-Support System
### *Transforming GeoAI Satellite Pipeline Detections into Executive Town Planning & Vigilance Enforcement for Nagpur Municipal Corporation*

[![System Status](https://img.shields.io/badge/System-Active%20%26%20Verified-brightgreen)](http://localhost:5173)
[![Phase](https://img.shields.io/badge/Phase-Phase%205%20Complete-blue)](#-system-architecture)
[![Backend](https://img.shields.io/badge/Backend-FastAPI%20%2F%20Python%203.11+-009688)](https://fastapi.tiangolo.com/)
[![Frontend](https://img.shields.io/badge/Frontend-React%2018%20%2F%20Vite-61DAFB)](https://vitejs.dev/)
[![YOLOv8](https://img.shields.io/badge/AI--Vision-YOLOv8%20Building%20Segmentation-FF6F00)](https://ultralytics.com/)
[![Explainability](https://img.shields.io/badge/LLM--Layer-Grok%20%2F%20Gemini%20%2B%20Fallback-8E44AD)](#-grok--gemini-explanation-layer)

---

## 🏆 Executive Summary & Pitch Benchmark

**Nagpur EarthWatch** is an enterprise-grade, end-to-end GeoAI municipal surveillance and decision-support portal built specifically for the **Nagpur Municipal Corporation (NMC) Town Planning & Vigilance Department**. 

While conventional satellite monitoring applications bombard non-technical municipal officers with raw computer vision metrics (IoU, SSIM, bounding box losses), **NMC EarthWatch** bridges the gap between complex multi-spectral satellite intelligence and actionable municipal governance. Within **10 seconds**, a Town Planning Officer can identify:
1. **WHAT HAPPENED?** — Exact physical change emergence (e.g. *New 1,812 px structure detected*).
2. **WHERE & WHEN?** — Specific ward corridor, zone, coordinates, and observation timeframe (2019–2025).
3. **WHY PRIORITY?** — Explainable, rule-backed municipal priority justification.
4. **RECOMMENDED ACTION** — Clear, actionable municipal next steps (*Field Inspection Required* vs *Routine Monitoring*).

---

## 🎯 Key Problems Solved & Innovation Highlights

| Problem in Existing Systems | NMC EarthWatch Solution |
| :--- | :--- |
| ❌ **False Positive Overload**: Satellite change detection suffers from seasonal vegetation shifts, sun angle variation, and atmospheric noise. | ✅ **Multi-Scale Verification & Alignment Matrix**: Fuses 10m Sentinel-2 multi-spectral data with sub-meter 0.6m orthophoto differencing, SSIM divergence, and edge emergence analysis. |
| ❌ **Technical Jargon Barrier**: Municipal officers are overwhelmed by raw IoU numbers, confidence scores, and bounding box coordinates. | ✅ **Executive Officer View**: Translates complex computer vision metrics into 10-second human-readable checklists and actionable priority tiers (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`). |
| ❌ **Opaque Black-Box AI**: Officers cannot trust "black-box" neural network scores when deploying field teams. | ✅ **Transparent Priority Engine + Adaptive XGBoost**: Evaluates physical footprint area, evidence quality, and municipal sensitivity with transparent scoring rules. |
| ❌ **Unsubstantiated Legal Claims**: AI systems erroneously label changes as "illegal construction" without municipal record verification. | ✅ **Responsible Governance Guardrails**: Strict municipal safety protocols ensure the AI flags *physical structure emergence* while directing officers to cross-reference official permit records. |
| ❌ **Fragile API Dependencies**: Cloud LLM outages crash decision portals during field audits. | ✅ **Deterministic Fallback Engine**: If Gemini/Grok API keys are missing or rate-limited, a local deterministic generator generates verified explanations. The portal **never crashes**. |

---

## 🔄 End-to-End Decision Pipeline Architecture

```text
                  REAL-WORLD EARTH DATA
                            │
       ┌────────────────────┴────────────────────┐
       ▼                                         ▼
10m Sentinel-2 Multi-Spectral             0.6m High-Res Wayback Imagery
  (Surface & Veg Delta)                    (Sub-Meter Orthophotos)
       │                                         │
       └────────────────────┬────────────────────┘
                            ▼
           STAGE 1: YOLOv8 BUILDING SEGMENTATION
                (Keremberke Building Mask Model)
                            │
                            ▼
        STAGE 2: MULTI-SCALE OPTICAL VERIFICATION
             (IoU + SSIM Divergence + Edge Texture)
                            │
                            ▼
           STAGE 3: STRUCTURED FEATURE EXTRACTION
               (13 Numerical & Categorical Features)
                            │
                            ▼
          STAGE 4: RULE-BASED PRIORITY ENGINE
             (Transparent Municipal Risk Scoring)
                            │
                            ▼
               HUMAN NMC OFFICER FEEDBACK
       (Confirmed / False Positive / Needs Review)
                            │
                            ▼
          STAGE 5: ADAPTIVE XGBOOST MODEL
          (Learns from Reviewed Field Cases)
                            │
                            ▼
       STAGE 6: GROK / GEMINI EXPLANATION LAYER
            (Plain-Language Officer Summary)
                            │
                            ▼
         STAGE 7: DETERMINISTIC FALLBACK LAYER
             (Zero-Downtime Guarantee)
                            │
                            ▼
             NMC TOWN PLANNING OFFICER ACTION
              (Dossier Export & Field Audit)
```

---

## 🛠️ Comprehensive Technology Stack & Architecture Breakdown

### 1. 🛰️ Earth Observation & Satellite Data Infrastructure
- **Copernicus Sentinel-2 L2A Granules**: 10m spatial resolution multispectral granules (Bands B02-Blue, B03-Green, B04-Red, B08-NIR) fetched via Copernicus Data Space Ecosystem (CDSE) STAC / OData APIs.
- **Esri Wayback Historical Satellite Mosaics**: High-resolution ~0.6m sub-meter optical orthophotos (World Imagery Tiled Map Service) for multi-year baseline comparison (2019 baseline vs 2025 current scene).
- **OpenStreetMap & Nominatim Geocoding API**: Asynchronous spatial boundary lookup for Nagpur Municipal Corporation (NMC) ward boundaries, zones, and parcel coordinates.

### 2. 🧠 Deep Learning, Computer Vision & AI Models
- **YOLOv8 Small Instance Segmentation (`keremberke/yolov8s-building-segmentation`)**: PyTorch pre-trained model for pixel-level building footprint extraction, contour delineation, and bounding mask generation.
- **PyTorch (`torch` v2.x)**: CUDA hardware acceleration engine with automatic GPU VRAM detection and CPU fallback.
- **OpenCV (`opencv-python` v4.x)**: Image preprocessing, Otsu adaptive thresholding, Canny edge emergence detection, bounding contour extraction, color difference overlays, and annotated image generation (`before_annotated.jpg`, `after_annotated.jpg`, `change_mask.png`).
- **Scikit-Image (`skimage.metrics.structural_similarity`)**: Structural Similarity Index Measure (SSIM) matrix evaluation for structural divergence scoring.

### 3. 🤖 Machine Learning & Adaptive Priority Engine
- **XGBoost Classifier (`xgboost.XGBClassifier`)**: Gradient boosted decision tree model trained on officer feedback decisions (`CONFIRMED`, `FALSE_POSITIVE`, `NEEDS_REVIEW`) to dynamically refine risk scoring weights when reviewed cases $\ge 10$.
- **Scikit-Learn (`scikit-learn`)**: Feature pre-processing, metric evaluation (Accuracy, F1-Score), and label encoding (`LabelEncoder`).
- **NumPy (`numpy`) & SciPy (`scipy`)**: Vectorized matrix calculations, IoU (Intersection-over-Union) bounding box matching, and spatial overlap geometry.
- **Pandas (`pandas`)**: Tabular feature manipulation and feedback dataset loading.

### 4. 💬 Governance LLM Explanation Layer & Resilient Fallback
- **Grok 2 API / Gemini 1.5 Pro API (`google-generativeai`, `urllib.request`)**: Large language model integration generating plain-language municipal governance summaries tailored for non-technical NMC Town Planning & Vigilance Officers.
- **Deterministic Governance Fallback Engine**: Local rule-based explanation synthesis engine that guarantees zero portal downtime if API keys are missing or rate-limited.

### 5. ⚡ Asynchronous Backend Framework & REST API
- **FastAPI (v0.100+)**: Modern, high-performance Python ASGI web framework supplying REST endpoints with CORS middleware (`allow_origins=["*"]`) and dual HTTP method handling (`GET` & `POST`).
- **Uvicorn**: Lightning-fast ASGI server implementation for asynchronous concurrency.
- **Pydantic (v2.x)**: Strict type annotations, request validation models (`AnalyzeRequest`, `YoloAnalyzeRequest`, `PriorityEvaluateRequest`, `PriorityFeedbackRequest`), and JSON schema generation.
- **Python Standard Library**: `pathlib`, `json`, `time`, `urllib.request`, `dataclasses`, `typing`, `os`, `math`, `unittest`.

### 6. 💻 Modern Web Frontend & Responsive UI
- **React 18**: Component-based user interface architecture supporting dual-tier views (`🏛 Officer View` & `🔬 Analyst View`).
- **Vite (v5.x)**: Next-generation frontend build tool with instant Hot Module Replacement (HMR) and optimized rollup production bundles.
- **Vanilla CSS Modules (`*.module.css`)**: Encapsulated component styling featuring glassmorphism cards, glowing status pills, dynamic dark mode palette (`#0B1120`), and custom scrollbars.
- **JavaScript (ES6+)**: Modern asynchronous `async/await` fetch networking, local state management, and event handling.

### 7. 📦 Version Control, Build & Automated Testing
- **Git & GitHub**: Distributed version control system hosted on remote branch `dhanshri-agentic`.
- **Python `unittest` Framework**: 6 automated test suites (`test_priority_engine.py`, `test_explanation_engine.py`, `test_municipal_fusion.py`, `test_multiscale_verification.py`, `test_building_segmentation.py`, `test_building_change.py`) verifying 100% test pass rate with exit code 0.

---

## 🌟 Core System Features & Capabilities

### 1. 📊 Executive Case Overview & Priorities Modal
- Instant top-level dashboard overlay triggered via **`📊 Case Overview`** button.
- Displays key city-wide metrics: Total Active Cases, High Priority Flags, Total New Built Area ($m^2$), and Average Field Verification Strength.
- Interactive priorities table enabling direct 1-click **Inspect 🔍** triggers.

### 2. 🏛️ Dual-View Interface: Officer View vs. Analyst View
- **🏛️ Officer View (Default)**: Optimized for rapid executive decision-making. Displays human-readable change summaries, evidence strength badges (`🟢 STRONG`), and recommended municipal actions.
- **🔬 Analyst View (Technical Accordion)**: Collapsible technical deep-dive exposing raw YOLO neural confidence, spatial IoU overlap, SSIM divergence matrices, edge emergence rates, and GPU hardware inference telemetry (`NVIDIA RTX 3050`).

### 3. 🏗️ YOLOv8 Building Intelligence & Change Assessment Workbench
- Side-by-side historical baseline (2019) vs current scene (2025) imagery comparison with interactive split-slider and optical change overlays.
- Detailed card grid listing all detected structures (`BLDG-001`, `BLDG-002`, etc.) with individual change badges (`NEW`, `EXPANDED`, `PERSISTENT`).
- **Dedicated Building Change Explanations Panel**: Explicitly details every detected building change with footprint area, YOLO confidence, and field inspection justifications.

### 4. 🧠 Phase 5 Adaptive Municipal Priority & Machine Learning Layer
- **Rule-Based Municipal Priority Engine** (`backend/priority_engine.py`): Deterministic scoring algorithm factoring physical change footprint (+30 pts), evidence strength (+25 pts), new emergence (+20 pts), and municipal ward sensitivity (+15 pts).
- **Officer Feedback Store** (`backend/priority_training.py`): Logs officer decisions (`CONFIRMED`, `FALSE_POSITIVE`, `NEEDS_REVIEW`) to [`outputs/officer_feedback.json`](file:///c:/Work/Nagpur_X/outputs/officer_feedback.json) as genuine ground-truth training data.
- **XGBoost Adaptive Model** (`backend/priority_xgboost.py`): Learns priority patterns from reviewed cases. Safely falls back to the Rule Engine when labelled cases $< 10$, displaying `Adaptive Model: Not Ready (Insufficient labelled officer cases)`.
- **Grok / Gemini Explanation Layer** (`backend/explanation_engine.py`): Translates structured evidence into plain-language officer explanations under strict governance prompts.

---

## 🚀 Quick Start & Installation Guide

### Prerequisites
- **Python**: `3.10` or `3.11`
- **Node.js**: `v18+` & `npm`
- **GPU (Optional)**: NVIDIA GPU with CUDA support for accelerated YOLO inference

### 1. Clone & Set Up Repository
```bash
git clone https://github.com/kevinfernandes-hub/newyuva.git
cd Nagpur_X
```

### 2. Configure Backend Environment
Create `backend/.env` file:
```env
GROK_API_KEY=your_grok_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Launch Backend FastAPI Server
```bash
# Install Python dependencies
pip install fastapi uvicorn opencv-python scikit-image ultralytics xgboost scikit-learn requests

# Start backend server on port 8000
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```
*Backend API documentation available at: `http://127.0.0.1:8000/docs`*

### 4. Launch Frontend Dev Server
```bash
# Install Node dependencies
npm install

# Start Vite dev server on port 5173
npm run dev
```
*Access frontend portal at: `http://localhost:5173`*

---

## 🧪 Verification & Test Suite Execution

We provide 6 automated test suites covering every layer of the multi-stage pipeline:

```bash
# 1. Test Feature Extraction & Rule-Based Priority Engine
python test_priority_engine.py

# 2. Test LLM Explanation Layer & Deterministic Fallback
python test_explanation_engine.py

# 3. Test Municipal Evidence Fusion Pipeline
python test_municipal_fusion.py

# 4. Test Multi-Scale Wayback Verification
python test_multiscale_verification.py

# 5. Test YOLOv8 Building Segmentation
python test_building_segmentation.py

# 6. Test Building Change Comparison
python test_building_change.py
```

To verify production frontend build compilation:
```bash
npx vite build
```

---

## 📂 Repository Directory Structure

```text
Nagpur_X/
├── backend/
│   ├── vision/
│   │   ├── yolo_pipeline.py          # YOLOv8 building segmentation engine
│   │   └── change_model.py           # Optical change differencing model
│   ├── priority_features.py          # Structured feature extraction (13 features)
│   ├── priority_engine.py            # Transparent rule-based municipal priority engine
│   ├── priority_training.py          # Officer feedback persistence store
│   ├── priority_xgboost.py           # XGBoost adaptive machine learning model
│   ├── explanation_engine.py         # Grok/Gemini explanation engine + fallback
│   ├── multiscale_verifier.py        # SSIM, IoU & edge emergence verification
│   ├── case_manager.py               # Municipal case registry & dossier builder
│   ├── geo_context.py                # Ward boundary & municipal zone lookup
│   ├── main.py                       # FastAPI application & API endpoints
│   └── .env                          # API key configuration
├── src/
│   ├── components/
│   │   ├── Header/                   # Simplified header with Case Overview button
│   │   ├── CaseSummaryModal/         # Executive case overview hub modal
│   │   ├── AIInspectionModal/        # 10-second clarity dossier & technical decision chain
│   │   ├── YOLOBuildingIntelligence/ # Building change assessment workbench & change explanations
│   │   └── SectorList/               # Municipal ward sector cards
│   ├── App.jsx                       # Main application page
│   └── App.module.css                # Global theme & layout CSS
├── outputs/
│   ├── officer_feedback.json         # Ground-truth training dataset from officer reviews
│   └── yolo_runs/                    # Cached YOLO detection runs & orthophoto crops
├── test_priority_engine.py           # Priority engine unit test suite
├── test_explanation_engine.py        # Explanation layer & fallback unit test suite
├── README.md                         # Master documentation & pitch README
└── package.json                      # Node dependencies & build scripts
```

---

## 🏛️ Responsible Governance & Municipal Compliance

**NMC EarthWatch** enforces strict administrative guardrails:
1. **Remote Sensing Limit**: Satellite imagery provides empirical evidence of *physical ground structure changes*. It does not by itself establish legal authorization.
2. **Mandatory Officer Verification**: The AI flags changes and prioritizes cases; the NMC Town Planning Officer makes all final administrative and legal decisions.
3. **Audit Trail**: Every officer review (`CONFIRMED`, `FALSE_POSITIVE`, `NEEDS_REVIEW`) is logged with timestamps for municipal vigilance audit compliance.

---

<p align="center">
  <b>Developed for Nagpur Municipal Corporation (NMC) Town Planning & Vigilance Department</b><br>
  <i>Powered by GeoAI, YOLOv8, XGBoost & Grok/Gemini Intelligence</i>
</p>