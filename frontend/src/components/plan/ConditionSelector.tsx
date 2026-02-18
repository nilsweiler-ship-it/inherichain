import { ConditionType, CONDITION_LABELS } from "../../types";

interface ConditionSelectorProps {
  value: ConditionType;
  onChange: (value: ConditionType) => void;
}

export function ConditionSelector({ value, onChange }: ConditionSelectorProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value) as ConditionType)}
      className="w-full bg-navy border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-gold transition-colors"
    >
      {Object.entries(CONDITION_LABELS).map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </select>
  );
}
