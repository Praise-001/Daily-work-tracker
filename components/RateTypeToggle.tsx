"use client";
import type { RateType } from "../lib/types";

interface Props {
  value: RateType;
  onChange: (v: RateType) => void;
}

export default function RateTypeToggle({ value, onChange }: Props) {
  return (
    <div className="rate-toggle">
      <button
        type="button"
        className={`rate-toggle-btn${value === "hour" ? " active" : ""}`}
        onClick={() => onChange("hour")}
      >
        Per Hour
      </button>
      <button
        type="button"
        className={`rate-toggle-btn${value === "day" ? " active" : ""}`}
        onClick={() => onChange("day")}
      >
        Per Day
      </button>
    </div>
  );
}
