interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
}

/** 36×20 rounded switch (account settings), Figma "chk" toggle frames. */
export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle ${checked ? "toggle--on" : "toggle--off"}`}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-knob" />
    </button>
  );
}
