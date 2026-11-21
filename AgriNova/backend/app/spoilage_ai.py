from dataclasses import dataclass
from typing import Literal

RiskLevel = Literal["Low", "Medium", "High", "Critical"]

CATEGORY_BASELINES: dict[str, dict[str, float]] = {
    "tomato": {"ideal_temp_min": 10.0, "ideal_temp_max": 15.0, "ideal_hum_min": 80.0, "ideal_hum_max": 90.0, "max_days": 10.0, "sensitivity": 1.35},
    "mango": {"ideal_temp_min": 10.0, "ideal_temp_max": 14.0, "ideal_hum_min": 85.0, "ideal_hum_max": 92.0, "max_days": 12.0, "sensitivity": 1.25},
    "banana": {"ideal_temp_min": 13.0, "ideal_temp_max": 15.0, "ideal_hum_min": 85.0, "ideal_hum_max": 95.0, "max_days": 10.0, "sensitivity": 1.3},
    "potato": {"ideal_temp_min": 4.0, "ideal_temp_max": 10.0, "ideal_hum_min": 85.0, "ideal_hum_max": 95.0, "max_days": 60.0, "sensitivity": 0.75},
    "onion": {"ideal_temp_min": 0.0, "ideal_temp_max": 8.0, "ideal_hum_min": 65.0, "ideal_hum_max": 75.0, "max_days": 90.0, "sensitivity": 0.65},
    "rice": {"ideal_temp_min": 10.0, "ideal_temp_max": 22.0, "ideal_hum_min": 50.0, "ideal_hum_max": 65.0, "max_days": 180.0, "sensitivity": 0.4},
    "wheat": {"ideal_temp_min": 10.0, "ideal_temp_max": 22.0, "ideal_hum_min": 50.0, "ideal_hum_max": 65.0, "max_days": 180.0, "sensitivity": 0.4},
}


@dataclass
class SpoilageAssessment:
    risk_score: int
    risk_level: RiskLevel
    explanations: list[str]
    recommendations: list[str]
    model_note: str


def predict_spoilage(
    category: str,
    temperature_c: float,
    humidity_pct: float,
    storage_hours: float = 12.0,
    transport_delay_hours: float = 0.0,
) -> SpoilageAssessment:
    """
    Transparent rule-based baseline model for food spoilage risk assessment.
    Designed to avoid unverified claims until real regional sensor datasets are attached.
    """
    key = category.strip().lower()
    baseline = CATEGORY_BASELINES.get(key, CATEGORY_BASELINES["tomato"])

    score = 8.0
    explanations: list[str] = []
    recommendations: list[str] = []

    # 1. Temperature excursion
    if temperature_c > baseline["ideal_temp_max"]:
        excess = temperature_c - baseline["ideal_temp_max"]
        score += min(45.0, excess * 2.4 * baseline["sensitivity"])
        explanations.append(
            f"Temperature ({temperature_c:.1f}°C) exceeds safe range ({baseline['ideal_temp_min']:.0f}–{baseline['ideal_temp_max']:.0f}°C) by {excess:.1f}°C."
        )
        recommendations.append(
            f"Reduce cooling chamber or reefer setpoint toward {baseline['ideal_temp_max']:.0f}°C immediately."
        )
    elif temperature_c < baseline["ideal_temp_min"]:
        deficit = baseline["ideal_temp_min"] - temperature_c
        score += min(28.0, deficit * 2.0 * baseline["sensitivity"])
        explanations.append(
            f"Temperature ({temperature_c:.1f}°C) is below ideal range, risking chilling injury."
        )
        recommendations.append(
            f"Raise storage temperature above {baseline['ideal_temp_min']:.0f}°C to prevent cold damage."
        )

    # 2. Humidity deviation
    if humidity_pct > baseline["ideal_hum_max"]:
        hum_excess = humidity_pct - baseline["ideal_hum_max"]
        score += min(20.0, hum_excess * 1.1)
        explanations.append(
            f"High humidity ({humidity_pct:.0f}%) accelerates fungal/mold growth (ideal <= {baseline['ideal_hum_max']:.0f}%)."
        )
        recommendations.append("Increase airflow ventilation or activate dehumidifier pads inside crates.")
    elif humidity_pct < baseline["ideal_hum_min"]:
        hum_def = baseline["ideal_hum_min"] - humidity_pct
        score += min(16.0, hum_def * 0.7)
        explanations.append(f"Low humidity ({humidity_pct:.0f}%) increases moisture loss and wilting.")
        recommendations.append("Use breathable moisture-retaining crate liners.")

    # 3. Transport delay impact
    if transport_delay_hours > 0:
        delay_pts = min(28.0, transport_delay_hours * 4.5 * baseline["sensitivity"])
        score += delay_pts
        explanations.append(f"Transit delay of {transport_delay_hours:.1f} hours compounds thermal stress.")
        recommendations.append("Prioritize express dispatch or reroute to the nearest cold hub.")

    # 4. Storage duration relative to shelf life
    max_hours = baseline["max_days"] * 24.0
    age_ratio = min(1.0, max(0.0, storage_hours / max_hours))
    score += age_ratio * 22.0
    if age_ratio > 0.55:
        explanations.append(f"Batch has consumed {age_ratio * 100:.0f}% of its expected shelf window.")
        recommendations.append("Flag batch for priority retail sale or NGO food redistribution.")

    final_score = max(1, min(99, int(round(score))))
    if final_score >= 75:
        level: RiskLevel = "Critical"
        recommendations.append("Urgent: Divert immediately to local market discount or NGO rescue within 6 hours.")
    elif final_score >= 52:
        level = "High"
        recommendations.append("Inspect crates upon arrival and prioritize first-out dispatch.")
    elif final_score >= 28:
        level = "Medium"
        recommendations.append("Increase IoT sensor check frequency to every 30 minutes.")
    else:
        level = "Low"
        if not explanations:
            explanations.append("Storage temperature, humidity, and transit schedule are within safe thresholds.")
        if not recommendations:
            recommendations.append("Maintain current cold-chain settings and standard dispatch queue.")

    return SpoilageAssessment(
        risk_score=final_score,
        risk_level=level,
        explanations=explanations,
        recommendations=list(dict.fromkeys(recommendations)),
        model_note="Transparent rule-based baseline calibrated per produce category (ready for historical IoT training data).",
    )
