"use client";
import { type ReactNode } from "react";

interface Props {
  steps: ReactNode[];
  currentStep: number;
  transitioning: boolean;
}

export default function StepWizard({ steps, currentStep, transitioning }: Props) {
  const total = steps.length;

  return (
    <div className="wizard-page">
      <div className="wizard-wrap">
        {/* Progress dots */}
        <div className="wizard-dots">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className={`wizard-dot${i === currentStep ? " active" : i < currentStep ? " done" : ""}`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className={`wizard-step ${transitioning ? "step-exit" : "step-enter"}`}>
          {steps[currentStep]}
        </div>
      </div>
    </div>
  );
}
