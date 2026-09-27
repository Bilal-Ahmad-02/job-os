/** Decorative identity artwork, not a model activity or telemetry indicator. */
export default function OracleMark() {
  return (
    <div className="oracle-mark" aria-hidden="true">
      <svg viewBox="0 0 240 240" fill="none" focusable="false" aria-hidden="true">
        <path
          className="mark-grid"
          d="M0 60h240M0 120h240M0 180h240M60 0v240M120 0v240M180 0v240"
        />
        <circle className="mark-ring" cx="120" cy="120" r="102" strokeDasharray="2 7" />
        <circle className="mark-orbit" cx="120" cy="120" r="88" strokeDasharray="95 18 15 32" />
        <path
          className="mark-ring"
          d="M120 40 189 80v80l-69 40-69-40V80zM120 28v18M120 194v18M28 120h18M194 120h18"
        />
        <path
          className="mark-crosshair"
          d="M10 30V10h20M210 10h20v20M230 210v20h-20M30 230H10v-20"
        />
      </svg>
      <img src="/oracle.png" alt="" width="86" height="86" />
    </div>
  );
}
