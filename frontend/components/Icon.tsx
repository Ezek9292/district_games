/** The app's one icon set: 24px line icons drawn in the current text colour. Decorative unless labelled. */
const PATHS = {
  plus: "M12 5v14M5 12h14",
  close: "M6 6l12 12M18 6L6 18",
  camera: "M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 100-8 4 4 0 000 8z",
  alert: "M12 3l10 18H2zM12 10v5M12 18v.01",
  check: "M5 12.5l4.5 4.5L19 7",
  back: "M15 5l-7 7 7 7",
  pencil: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  out: "M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, label }: { name: IconName; size?: number; label?: string }) {
  return (
    <svg
      className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
