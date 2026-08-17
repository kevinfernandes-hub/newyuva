"""
Automated Verification for AI Zoom-and-Verify Agent
"""

import sys
from backend.hotspots import get_hotspots_for_location, compute_hotspot_priority
from backend.vision_inspector import execute_zoom_and_verify_agent, fuse_confidence_scores


def test_hotspot_extraction_and_ranking():
    print("[1/3] Testing Hotspot Extraction & Priority Ranking...")
    hotspots = get_hotspots_for_location("mihan")
    assert len(hotspots) >= 4, f"Expected at least 4 hotspots for MIHAN, got {len(hotspots)}"

    top_hotspot = hotspots[0]
    print(f"  Top Hotspot: {top_hotspot['hotspot_id']} ({top_hotspot['name']})")
    print(f"  Priority: {top_hotspot['priority']} (Score: {top_hotspot['priority_score']})")
    print(f"  Area: {top_hotspot['area_formatted']}")
    print(f"  Coordinates: {top_hotspot['coords_str']}")

    assert top_hotspot["priority"] in ["CRITICAL", "HIGH"], "Top hotspot should be CRITICAL or HIGH"
    assert top_hotspot["area_m2"] > 5000, "Area should be substantial"
    print("  ✓ Hotspot ranking logic verified.")


def test_confidence_fusion():
    print("[2/3] Testing Multi-Modal Confidence Fusion...")
    fused = fuse_confidence_scores(
        initial_10m=82.0,
        highres_06m=91.0,
        ai_vision=94.0,
        spatial_consistency=90.0
    )
    print(f"  Fused Confidence: {fused['final_confidence']}% (Status: {fused['status']})")
    assert fused["final_confidence"] >= 88, "Expected high confidence score >= 88%"
    assert fused["status"] == "HIGH-CONFIDENCE CHANGE"
    print("  ✓ Confidence fusion formula verified.")


def test_zoom_and_verify_agent_execution():
    print("[3/3] Testing Full AI Zoom-and-Verify Agent Execution...")
    case = execute_zoom_and_verify_agent("MIHAN-042", location_id="mihan", base_url="http://localhost:8000")

    print(f"  Case Generated: {case['case_id']}")
    print(f"  Change Type: {case['change_type']} ({case['change_type_label']})")
    print(f"  Permit Status: {case['permit_status']}")
    print(f"  Action: {case['recommended_action']}")
    print(f"  Stages Completed: {len(case['stages'])}")
    print(f"  Zoom Levels Generated: {list(case['zoom_levels'].keys())}")

    assert case["case_id"] == "CASE #NGP-042"
    assert case["change_type"] == "NEW_CONSTRUCTION"
    assert case["final_confidence"] >= 90
    assert len(case["stages"]) == 7
    print("  ✓ End-to-end agent case generation verified.")


if __name__ == "__main__":
    test_hotspot_extraction_and_ranking()
    test_confidence_fusion()
    test_zoom_and_verify_agent_execution()
    print("\n✅ All AI Zoom-and-Verify Agent backend tests passed successfully!")
