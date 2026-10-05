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

/**
 * A slim dark cat curled asleep on the top perch of a grey cat tree with a cubby, a side
 * platform, a hammock shelf and sisal posts. Decoration for a slot that has no agent yet.
 */
export const sleepingCat = [
  "...................Z..",
  ".................Z....",
  ".............NNNN.....",
  "...........NnNNNNNN...",
  "..........eNNNnNNNNN..",
  "..........LNNNNNNNNNL.",
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

/** A winged glider seen from the side, facing right. An original figure for the roaming slot. */
export const nightGlider = [
  "......WW........",
  ".....WCCW...WW..",
  "....WCCCCW.WCCW.",
  "..WWCCCCCCWCCECW",
  ".WCCCCCCCCCCCCW.",
  "WCCCCCCCGGGCW...",
  ".WWCCCCGGGWW....",
  "...WCCWWW.......",
  "..WCW...........",
  ".WW.............",
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
