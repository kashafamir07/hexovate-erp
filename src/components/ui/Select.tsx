import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useClickOutside } from "../../lib/useClickOutside";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** toolbar chip (sm) or form input (md/lg) */
  size?: "sm" | "md";
  icon?: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}

/** Figma-style select: rounded box with chevron + popover options. */
export function Select({ value, onChange, options, size = "sm", icon, className = "", ariaLabel }: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));
  const current = options.find((o) => o.value === value);

  return (
    <div className={`select select--${size} ${className}`.trim()} ref={ref}>
      <button
        type="button"
        className="select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
      >
        {icon ? <span className="select-icon">{icon}</span> : null}
        <span className="select-value">{current ? current.label : ""}</span>
        <ChevronDown aria-hidden="true" className="select-chevron" />
      </button>
      {open ? (
        <ul className="select-menu" role="listbox" tabIndex={-1}>
          {options.map((opt) => (
            <li key={opt.value}>
              <button
                type="button"
                role="option"
                aria-selected={opt.value === value}
                className={`select-option ${opt.value === value ? "selected" : ""}`.trim()}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <span>{opt.label}</span>
                {opt.value === value ? <Check aria-hidden="true" className="select-check" /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
