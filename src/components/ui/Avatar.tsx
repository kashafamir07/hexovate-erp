interface AvatarProps {
  initials: string;
  color: string;
  title?: string;
  className?: string;
}

/** Initials avatar — the Figma design uses 2-letter colored circles. */
export function Avatar({ initials, color, title, className = "" }: AvatarProps) {
  return (
    <span
      className={`avatar ${className}`.trim()}
      style={{ backgroundColor: color }}
      title={title}
      role="img"
      aria-label={title || initials}
    >
      {initials}
    </span>
  );
}
