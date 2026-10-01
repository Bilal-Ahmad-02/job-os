const paths = {
  lock: "M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5zM12 14v3",
  refresh: "M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1",
  plus: "M12 5v14M5 12h14",
  search: "M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  back: "M19 12H5M11 6l-6 6 6 6",
  save: "M4 3h13l4 4v14H3V3zM7 3v6h9V3M7 21v-8h10v8",
} as const;

/** Decorative icons always accompany a visible text label. */
export default function Icon({ name }: { name: keyof typeof paths }) {
  return (
    <svg
      className="icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}
