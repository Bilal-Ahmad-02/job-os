/** Original pixel figures drawn as SVG rectangles. No external image or licensed artwork. */

const palette: Record<string, string> = {
  K: "#0b1410",
  H: "#16241c",
  G: "#70ee9c",
  F: "#b7d9c2",
  C: "#1e3528",
  D: "#12241a",
  B: "#060a08",
  S: "#8aa397",
  s: "#4c6157",
  E: "#70ee9c",
};

const investigatorTop = [
  "....HHHH....",
  "...HHHHHH...",
  ".HHHHHHHHHH.",
  "...FFFFFK...",
  "...EFFEFK...",
  "...FFFFFK...",
  "..GCCCCCCG..",
  ".CCCCCCCCCC.",
  ".CCDCCCCDCC.",
  ".CCDCCCCDCC.",
  ".FCDCCCCDCF.",
  "..CDCCCCDC..",
  "..CCCCCCCC..",
  "..CCCGGCCC..",
  "..CCC..CCC..",
];
/** A coated investigator: the figure standing for the job-search console. Two walking frames. */
export const investigator = [
  [...investigatorTop, "..KK....KK..", "..KK....KK..", ".BBB...BBB.."],
  [...investigatorTop, "...KK..KK...", "...KK..KK...", "..BBB.BBB..."],
];

/** A seated machine figure standing for the Oracle core. */
export const overseer = [
  "...SSSSSS...",
  "..SSSSSSSS..",
  "..SEESSEES..",
  "..SSSSSSSS..",
  "...SssssS...",
  ".....SS.....",
  ".sSSSSSSSSs.",
  ".SSsSSSSsSS.",
  ".SSsSSSSsSS.",
  ".S.sSSSSs.S.",
  "...SSSSSS...",
  "...Ss..sS...",
  "...Ss..sS...",
  "..sss..sss..",
];

/** Draws one frame, merging each horizontal run of a colour into a single rectangle. */
export function PixelSprite({
  rows,
  x = 0,
  y = 0,
  scale = 1,
  className,
}: {
  rows: readonly string[];
  x?: number;
  y?: number;
  scale?: number;
  className?: string;
}) {
  const cells = [];
  for (const [row, line] of rows.entries()) {
    let start = 0;
    while (start < line.length) {
      const code = line[start] ?? ".";
      let end = start + 1;
      while (end < line.length && line[end] === code) end += 1;
      const fill = palette[code];
      if (fill)
        cells.push(
          <rect
            key={`${row}-${start}`}
            x={x + start * scale}
            y={y + row * scale}
            width={(end - start) * scale}
            height={scale}
            fill={fill}
          />,
        );
      start = end;
    }
  }
  return (
    <g className={className} shapeRendering="crispEdges">
      {cells}
    </g>
  );
}
