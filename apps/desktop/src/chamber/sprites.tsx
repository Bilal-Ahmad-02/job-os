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
  W: "#376347",
  Z: "#70ee9c",
  L: "#8d949c",
  l: "#666d75",
  Y: "#b9a063",
  N: "#2b2420",
  n: "#4a3d36",
  e: "#5a463c",
  k: "#000000",
  P: "#ffe9b0",
  A: "#ff9d3c",
  V: "#7a3cff",
  v: "#3b1f7a",
};

/** One drawing or several: each frame is rows of palette letters, with "." for nothing. */
export type Frames = readonly (readonly string[])[];

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

/** A machine figure seated behind a console, standing for the Oracle core. */
export const overseer = [
  ".........SSSSSS.........",
  "........SSSSSSSS........",
  "........SEESSEES........",
  "........SSSSSSSS........",
  ".........SssssS.........",
  "...........SS...........",
  ".......sSSSSSSSSs.......",
  ".......SSsSSSSsSS.......",
  ".......SSsSSSSsSS.......",
  ".......S.sSSSSs.S.......",
  "......SS.SSSSSS.SS......",
  "..WWWWWWWWWWWWWWWWWWWW..",
  ".DDDDDDDDDDDDDDDDDDDDDD.",
  "DDDDDDDDDDDDDDDDDDDDDDDD",
  "BBBBBBBBBBBBBBBBBBBBBBBB",
];

/** A grey cat tree with a cubby, a side platform, a hammock shelf and sisal posts. */
export const catTree = [
  "......................",
  "......................",
  "......................",
  "......................",
  "......................",
  "..........L.........L.",
  "..........LLLLLLLLLLL.",
  "...........lllllllll..",
  "..............YY......",
  "..............YY......",
  "..............YY......",
  "..............YY......",
  "..LLLLLLLL....YY......",
  "...llllll.....YY......",
  ".....LL..LLLLLLLLLLLL.",
  ".....LL..LllllllllllL.",
  ".....LL..LlllBBBBlllL.",
  ".....LL..LllBBBBBBllL.",
  ".....LL..LllBBBBBBllL.",
  ".....LL..LlllBBBBlllL.",
  ".....LL..LllllllllllL.",
  ".....LL..LLLLLLLLLLLL.",
  "...LLLLLLLLLLLLLLLLLL.",
  "....llllllllllllllll..",
  ".....LL......LL...LL..",
  ".....LL......LL...LL..",
  ".....LL......LL...LL..",
  "LLLLLLLLLLLLLLL...LL..",
  ".lllllllllllll....LL..",
  "...YY.LL.....LL...LL..",
  "...YY.LL.....LL...LL..",
  "...YY.LL.....LL...LL..",
  ".LLLLLLLLLLLLLLLLLLLL.",
  "LLLLLLLLLLLLLLLLLLLLLL",
];

/** A slim dark cat curled up asleep. */
export const catCurled = [
  "....NNNNN...",
  "..NnNNNNNNN.",
  ".eNNNnNNNNNN",
  ".NNNNNNNNNNN",
  "..NNNNNNNNN.",
];

/** The same cat on its feet, facing left. */
export const catAwake = [
  "e.e.......N.",
  "NNN.......N.",
  "NnNNNNNNNNN.",
  "NNNNNNNNNN..",
  ".NNNNNNNNN..",
  ".N.N...N.N..",
  ".N.N...N.N..",
];

/** A hovering fighter inside a glow. An original figure, not a likeness of any character. */
export const hoveringFighter = [
  "....GGGG....",
  "...G....G...",
  "..G.HHHH.G..",
  "..G.FFFF.G..",
  ".G..EFFE..G.",
  ".G..FFFF..G.",
  ".G.CCCCCC.G.",
  "G.FCCCCCCF.G",
  "G.FCDCCDCF.G",
  "G..CCCCCC..G",
  ".G.CCGGCC.G.",
  ".G.CC..CC.G.",
  "..G.K..K.G..",
  "..G.B..B.G..",
  "...G....G...",
  "....GGGG....",
];

/** A cloaked night watcher. An original figure, not a likeness of any character. */
export const cloakedWatcher = [
  "....WWWW....",
  "...WWWWWW...",
  "...WFFFFW...",
  "...WEFFEW...",
  "...WWFFWW...",
  "..WWWWWWWW..",
  ".WWDCCCCDWW.",
  ".WWDCCCCDWW.",
  ".WWDCGGCDWW.",
  ".WWDCCCCDWW.",
  ".WWDCCCCDWW.",
  ".WW.CCCC.WW.",
  ".W..CCCC..W.",
  ".W..CC.CC.W.",
  "....HH.HH...",
  "....HH.HH...",
  "...BBB.BBB..",
];

/**
 * A ray seen from above, head at the top. An original figure for the one that swims under the
 * platform; it is turned to face the way it is going.
 */
export const deepRay = [
  ".......WW.......",
  "......WCCW......",
  "......WCCW......",
  ".....WCCCCW.....",
  "..WWWCCCCCCWWW..",
  ".WCCCCCGGCCCCCW.",
  "WCCCCCCGGCCCCCCW",
  "WCCCCCCCCCCCCCCW",
  ".WCCCCCCCCCCCCW.",
  "..WWCCCCCCCCWW..",
  "....WCCCCCCW....",
  ".....WCCCCW.....",
  "......WCCW......",
  "......WCCW......",
  ".......WW.......",
  ".......WW.......",
  ".......WW.......",
];

/**
 * A black hole seen at a tilt: a dark core inside a bright ring, and a disc of dust whose two
 * arms turn once over eight frames. Worked out from distances rather than drawn row by row,
 * two pixels to each unit of distance, and only as tall as the flattened disc needs.
 */
export const blackHole: Frames = Array.from({ length: 8 }, (_, frame) =>
  Array.from({ length: 34 }, (_, row) =>
    Array.from({ length: 60 }, (_, column) => {
      const [dx, dy] = [(column - 29.5) / 2, (row - 16.5) / 2];
      const core = Math.hypot(dx, dy);
      const disc = Math.hypot(dx, dy * 2.6);
      const arm = Math.sin(Math.atan2(dy * 2.6, dx) * 2 + disc * 0.7 - (frame / 8) * Math.PI * 2);
      // The near half of the disc passes in front of the core; the far half behind it.
      if (disc > 7 && disc < 14.5 && arm > -0.2 && (dy > 0 || core > 6.5))
        return disc < 10 ? "A" : arm > 0.5 ? "V" : "v";
      if (core < 5) return "k";
      return core < 6.5 ? "P" : ".";
    }).join(""),
  ),
);

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
