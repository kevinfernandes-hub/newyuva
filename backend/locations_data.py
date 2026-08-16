from typing import List, Dict, Any

PRESET_LOCATIONS: List[Dict[str, Any]] = [
    {
        "id": "mihan",
        "name": "MIHAN / Outer Ring Road",
        "subtitle": "South Ward IX — Aerospace & SEZ Corridor",
        "colorDiff": 7.06,
        "ssimArea": 9.20,
        "status": "elevated",
        "statusLabel": "Elevated Change",
        "coords": "79.020° E, 21.030° N → 79.074° E, 21.090° N",
        "coordinates": [21.0925, 79.0472],
        "ssimScore": 0.6840,
        "confidence": "high",
        "permits": [
            {"id": "NMC-SEZ-2023-4109", "plot": "Sector 14 Logistics", "status": "matched", "date": "14 Nov 2023"},
            {"id": "NMC-HWY-2024-1180", "plot": "Ring Road Interchange", "status": "matched", "date": "02 Mar 2024"},
            {"id": "UNSANCTIONED-091", "plot": "Survey No 211/4", "status": "unmatched", "date": "No Record"}
        ],
        "localImages": {
            "before": "/nagpur_before.png",
            "after": "/nagpur_after.png",
            "colorOverlay": "/change_overlay.png",
            "ssimOverlay": "/ssim_change_overlay.png"
        },
        "isPreview": False
    },
    {
        "id": "sadar",
        "name": "Sadar, Nagpur",
        "subtitle": "Central Ward II — Dense Commercial / Civil District",
        "colorDiff": 5.85,
        "ssimArea": 6.65,
        "status": "stable",
        "statusLabel": "Moderate / Stable",
        "coords": "79.065° E, 21.145° N → 79.100° E, 21.180° N",
        "coordinates": [21.1580, 79.0850],
        "ssimScore": 0.7412,
        "confidence": "high",
        "permits": [
            {"id": "NMC-COM-2024-0412", "plot": "Residency Rd Redevelop", "status": "matched", "date": "18 Jan 2024"},
            {"id": "NMC-RES-2023-8991", "plot": "Mount Rd Commercial", "status": "matched", "date": "05 Dec 2023"}
        ],
        "localImages": {
            "before": "/sadar_before.png",
            "after": "/sadar_after.png",
            "colorOverlay": "/sadar_change_overlay.png",
            "ssimOverlay": "/sadar_ssim_change_overlay.png"
        },
        "isPreview": False
    },
    {
        "id": "hingna",
        "name": "Hingna MIDC",
        "subtitle": "Industrial MIDC Zone — Heavy Manufacturing & Earthworks",
        "colorDiff": 6.16,
        "ssimArea": 18.34,
        "status": "flagged",
        "statusLabel": "Flagged / Divergent",
        "coords": "78.965° E, 21.095° N → 79.005° E, 21.135° N",
        "coordinates": [21.0700, 78.9950],
        "ssimScore": 0.5890,
        "confidence": "needs_review",
        "permits": [
            {"id": "MIDC-IND-2023-0198", "plot": "Plot B-14 Factory Shed", "status": "matched", "date": "09 Aug 2023"},
            {"id": "UNSANCTIONED-441", "plot": "Plot D-8 Quarry Grading", "status": "unmatched", "date": "No Record"},
            {"id": "UNSANCTIONED-442", "plot": "Encroachment Sector 3", "status": "unmatched", "date": "No Record"}
        ],
        "localImages": {
            "before": "/hingna_before_fixed.png",
            "after": "/hingna_after_fixed.png",
            "colorOverlay": "/hingna_change_overlay.png",
            "ssimOverlay": "/hingna_ssim_change_overlay.png"
        },
        "isPreview": False
    },
    {
        "id": "civil-lines",
        "name": "Civil Lines, Nagpur",
        "subtitle": "Administrative Ward I — High Court / Secretariat Zone",
        "colorDiff": 3.62,
        "ssimArea": 23.30,
        "status": "flagged",
        "statusLabel": "Flagged / Divergent",
        "coords": "79.050° E, 21.135° N → 79.088° E, 21.170° N",
        "coordinates": [21.1550, 79.0700],
        "ssimScore": 0.6375,
        "confidence": "needs_review",
        "permits": [
            {"id": "NMC-GOV-2024-0012", "plot": "Judicial Annex Wing", "status": "matched", "date": "11 Feb 2024"},
            {"id": "UNSANCTIONED-078", "plot": "Walkers Corridor Excavation", "status": "unmatched", "date": "No Record"}
        ],
        "localImages": {
            "before": "/civil_lines_before.png",
            "after": "/civil_lines_after.png",
            "colorOverlay": "/civil_lines_change_overlay.png",
            "ssimOverlay": "/civil_lines_ssim_change_overlay.png"
        },
        "isPreview": False
    }
]
