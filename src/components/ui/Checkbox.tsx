import { Check } from "lucide-react";

interface CheckboxProps {
  checked: boolean;
  label?: string;
  onClick?: () => void;
}

/**
 * Small task-row checkbox, 16px rounded 4px (Figma).
 * Interactive: clicking (or Space/Enter, as it is a button) flips the
 * visual state; the owner decides what the flip means.
 */
export function Checkbox({ checked, label, onClick }: CheckboxProps) {
  return (
    <button
      type="button"
      className={`checkbox ${checked ? "checkbox--checked" : "checkbox--unchecked"}`}
      role="checkbox"
      aria-checked={checked}
      aria-label={label ? `Mark ${label} ${checked ? "done" : "not done"}` : undefined}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      {checked ? <Check aria-hidden="true" /> : null}
    </button>
  );
}
