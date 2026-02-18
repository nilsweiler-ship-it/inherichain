import { Trash2 } from "lucide-react";
import type { HeirFormData } from "../../types";
import { CONDITION_LABELS } from "../../types";

interface HeirRowProps {
  heir: HeirFormData;
  index: number;
  onRemove: (index: number) => void;
}

export function HeirRow({ heir, index, onRemove }: HeirRowProps) {
  return (
    <div className="flex items-center gap-4 bg-navy rounded-lg p-3 border border-gray-700">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-mono text-gray-300 truncate">{heir.wallet}</p>
        <p className="text-xs text-gray-500">
          {heir.sharePercentage / 100}% &middot;{" "}
          {CONDITION_LABELS[heir.condition]}
        </p>
      </div>
      <button
        onClick={() => onRemove(index)}
        className="text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
