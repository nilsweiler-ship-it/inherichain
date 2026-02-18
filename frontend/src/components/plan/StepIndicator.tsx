import { clsx } from "clsx";
import { Check } from "lucide-react";

interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center mb-8">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={clsx(
                "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all",
                i < currentStep && "bg-gold border-gold text-navy-dark",
                i === currentStep && "border-gold text-gold",
                i > currentStep && "border-gray-600 text-gray-600"
              )}
            >
              {i < currentStep ? <Check className="w-5 h-5" /> : i + 1}
            </div>
            <span
              className={clsx(
                "text-xs mt-1",
                i <= currentStep ? "text-gold" : "text-gray-600"
              )}
            >
              {step}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={clsx(
                "w-16 h-0.5 mx-2 mt-[-1rem]",
                i < currentStep ? "bg-gold" : "bg-gray-600"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
