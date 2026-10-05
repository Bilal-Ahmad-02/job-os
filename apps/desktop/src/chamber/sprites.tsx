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
  A: "#7f8d87",
  a: "#4d5a55",
  T: "#1e3528",
  W: "#376347",
  Z: "#70ee9c",
  z: "#32ce74",
  k: "#39433f",
  w: "#2a4a37",
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
 * A dark grey cat curled asleep on top of a cat tower three boxes high. Decoration for a slot
 * that has no agent yet.
 */
export const sleepingCat = [
  "...............Z....",
  ".............Z......",
  "............z.......",
  "....a...a...........",
  "...aAa.aAa..........",
  "...AAAAAAAAAAAA.....",
  "..AAaAAaAAAAAAAAA...",
  "..AAAAkAAAAkAAAAAA..",
  "..AAAAAAAAAAkAAAAAa.",
  "...AAAAAAAAAAAAAAaa.",
  "....aaaaaaaaaaaaaa..",
  ".WWWWWWWWWWWWWWWWWW.",
  "..WWWWWWWWWWWWWWWW..",
  "....wwwwwwwwwwww....",
  "....wTTTTTTTTTTw....",
  "....wTTBBBBBBTTw....",
  "....wTTBBBBBBTTw....",
  "....wwwwwwwwwwww....",
  "...WWWWWWWWWWWWWW...",
  "....wwwwwwwwwwww....",
  "....wTTTTTTTTTTw....",
  "....wTTTTTTTTTTw....",
  "....wwwwwwwwwwww....",
  "...WWWWWWWWWWWWWW...",
  "....wwwwwwwwwwww....",
  "....wTTTTTTTTTTw....",
  "....wTTTTTTTTTTw....",
  "....wwwwwwwwwwww....",
  "..WWWWWWWWWWWWWWWW..",
  ".WWWWWWWWWWWWWWWWWW.",
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
