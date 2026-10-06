import {
  blackHole,
  catAwake,
  catCurled,
  catTree,
  cloakedWatcher,
  deepRay,
  type Frames,
  hoveringFighter,
  investigator,
  overseer,
  placeholder,
} from "./sprites";

/** Scene coordinates: a fixed canvas with a 2:1 isometric grid, origin at the far corner. */
export const SCENE = { width: 872, height: 560 } as const;
export function iso(x: number, y: number, z = 0): [number, number] {
  return [436 + (x - y) * 32, 100 + (x + y) * 16 - z];
}
/** Centre of the platform, where the Oracle core sits. */
export const CORE = { x: 6.5, y: 6.5 } as const;
/** The two sand timers, and how far above the floor the bar across each one's posts is. */
export const TIMERS = { left: [-1.5, 8.3], right: [15.2, 6.6], bar: 134 } as const;

export type Point = readonly [number, number];
/** A page behind a figure that has no function yet. Each one has its own look and says so. */
export type Room = {
  title: string;
  line: string;
  /** For a room without a stylesheet block of its own: its background, ink and accent. */
  look?: readonly [back: string, ink: string, accent: string];
};

/**
 * What a figure does while the hub's motion is on. All of it is decoration.
 * - `walk`: goes round the platform on foot and stops to call down falling stars.
 * - `tree`: a cat lives on a cat tree: sleeps, stretches, jumps down, hides, climbs back.
 * - `fly`: roams the whole space in the air, pausing to hover or to fire a beam.
 * - `vigil`: stands watch on top of a sand timer.
 * - `swim`: has no place on the platform and wanders beneath the whole space.
 * - `spin`: turns on the spot, off the platform.
 * - `loop`: stays put and plays one long strip over and over: a scene in itself.
 * - `roam`: follows its routine and has no effect of its own.
 * - `float`: hangs in the air, bobbing.
 */
export type Act = "walk" | "tree" | "fly" | "vigil" | "swim" | "spin" | "loop" | "roam" | "float";

/**
 * One stretch of a routine. A routine is a loop: it must end where it began.
 * Points are platform grid squares, except for a figure with a `prop`, whose actor moves inside
 * the prop and is placed in percentages of it.
 */
export type Beat = {
  /** Which drawing shows. Poses a figure has no drawing for fall back to its main one. */
  pose: string;
  /** Where the beat ends. Without it the figure stays put. */
  to?: Point;
  /** How long it lasts. A move without it takes as long as the figure's `pace` needs. */
  seconds?: number;
  /** Jump: how far above the higher end the arc peaks, in percent of the frame's height. */
  hop?: number;
  /** Gather speed, shed it, or both, instead of keeping a steady pace. */
  ease?: "in" | "out" | "both";
  /** Play the pose's frames through exactly once across the beat instead of looping them. */
  once?: true;
  /** Run the figure's effect (falling stars, a beam, turning panes) across the beat. */
  cast?: true;
  /** Turn to this side. Otherwise a figure faces the way it last moved. */
  face?: "left" | "right";
};

export type Agent = {
  id: string;
  slot: string;
  name: string;
  /** Shown under the name on the figure's tag. */
  note: string;
  act: Act;
  /** Built-in drawing: one frame or several. Drawings face left. */
  frames: Frames;
  /** Built-in drawings for particular poses. */
  poses?: Record<string, Frames>;
  /** Built-in drawing of a fixed thing the figure lives on. Its actor then moves inside it. */
  prop?: Frames;
  /**
   * File name, without extension, of owner-supplied art: `name` for the main drawing,
   * `name-pose` for a pose and `name-prop` for the prop.
   */
  sprite: string;
  /** Drawn width in scene units. Unused by the swimmer, which is sized by the space. */
  width: number;
  /** Where it stands on the platform grid. Absent for the swimmer, which roams under it all. */
  at?: Point;
  /** Height above the floor. */
  lift?: number;
  /** Marks its square on the floor. */
  pad?: true;
  /** Seen from above or adrift: the line from the orb ties to its middle, not its feet. */
  centred?: true;
  routine?: readonly Beat[];
  /** Speed of moves that give no time, in percent of the frame's width a second. */
  pace?: number;
  /** Seconds each frame of its looping strips is held, when the usual pace does not suit. */
  tempo?: number;
  /** Absent only for the job console, which is the one working module. */
  room?: Room;
};

/** What the choreography and the drawing need of anything that has poses, agent or not. */
export type Figure = Pick<
  Agent,
  "sprite" | "frames" | "poses" | "prop" | "routine" | "pace" | "lift"
> & { act?: Act };

/** A place given in scene units, for what stands off the platform's grid. */
function off(x: number, y: number): Point {
  const [across, down] = [(x - 436) / 32, (y - 100) / 16];
  return [(across + down) / 2, (down - across) / 2];
}

/** Beats that walk through `points` in turn. */
const through = (pose: string, points: readonly Point[], extra: Partial<Beat> = {}): Beat[] =>
  points.map((to) => ({ pose, to, ...extra }));
const stars: Beat = { pose: "cast", seconds: 7, cast: true };
/** One flight through `points`: gathering speed on the first leg and shedding it on the last. */
const flight = (points: readonly Point[]): Beat[] =>
  points.map((to, leg) => {
    const [first, last] = [leg === 0, leg === points.length - 1];
    const ease = first && last ? "both" : first ? "in" : last ? "out" : undefined;
    return { pose: "fly", to, ...(ease && { ease }) };
  });
const beamShot = (face: "left" | "right"): Beat[] => [
  { pose: "charge", seconds: 1.6, once: true, face },
  { pose: "fire", seconds: 2.6, cast: true, face },
];
const hop = (to: Point, seconds: number, height: number): Beat => ({
  pose: "hop",
  to,
  seconds,
  hop: height,
  once: true,
});

/**
 * The lake in the open ground on the left, seen almost from the side: where its middle is and
 * how far it reaches each way, in scene units.
 */
export const LAKE = { x: -235, y: 490, reach: 115, depth: 34 } as const;
// Where something that swims its length walks in, swims from and to, and climbs out. A swimmer
// stands lower than the surface, so these sit a little below the lake's middle line.
const SWIM_Y = LAKE.y + 29;
const SHORE = {
  east: off(LAKE.x + LAKE.reach + 30, SWIM_Y),
  enter: off(LAKE.x + LAKE.reach - 45, SWIM_Y),
  leave: off(LAKE.x - LAKE.reach + 45, SWIM_Y),
  // It comes out on the near shore, toward the far end.
  out: off(LAKE.x - LAKE.reach + 10, LAKE.y + 105),
};
const LAKESIDE = off(LAKE.x + LAKE.reach - 30, LAKE.y + 135);
// Two corners of the walker's patrol, which it passes in both directions.
const FRONT_RIGHT: Point = [12.7, 9.5];
const PASSAGE: Point = [12.75, 6.6];
// Places on the cat tree, as percentages of its drawing.
const PERCH: Point = [68, 15.3];
const LEDGE: Point = [25, 36.5];
const SHELF: Point = [27, 63.5];
const CUBBY: Point = [66, 59];
const HAMMOCK: Point = [31, 77.6];

export const AGENTS: readonly Agent[] = [
  {
    id: "jobs",
    slot: "01",
    name: "QUEST",
    note: "Job search / manual, no automation",
    act: "walk",
    frames: investigator,
    sprite: "job-os",
    width: 84,
    at: [9.9, 12.7],
    pad: true,
    pace: 1.9,
    // A patrol across the front of the court and up its right side, and back the same way. It
    // keeps clear of everything that stands on the court and of the flyer's whole circuit.
    routine: [
      { pose: "walk", to: FRONT_RIGHT },
      stars,
      ...through("walk", [PASSAGE, [9.3, 3.2], [11.6, 1.3]]),
      stars,
      ...through("walk", [[9.3, 3.2], PASSAGE, FRONT_RIGHT, [9.9, 12.7]]),
      stars,
    ],
  },
  {
    id: "perch",
    slot: "02",
    name: "PERCH",
    note: "No function yet",
    act: "tree",
    frames: [catAwake],
    poses: { sleep: [catCurled] },
    prop: [catTree],
    sprite: "slot-2",
    width: 140,
    // On the wing at the lower left, where nothing has to pass behind it.
    at: [6.5, 15.3],
    pad: true,
    pace: 9,
    routine: [
      { pose: "sleep", seconds: 16 },
      { pose: "wake", seconds: 1.8, once: true },
      { pose: "stretch", seconds: 2.8, once: true },
      hop(LEDGE, 0.9, 7),
      { pose: "sit", seconds: 2.5 },
      hop(SHELF, 0.8, 4),
      { pose: "walk", to: [50, 63.5] },
      hop(CUBBY, 0.6, 4),
      { pose: "hide", seconds: 6 },
      hop(SHELF, 0.9, 5),
      hop(HAMMOCK, 0.8, 4),
      { pose: "sit", seconds: 5 },
      hop([72, 91.8], 0.9, 5),
      { pose: "walk", to: [42, 91.8] },
      { pose: "sit", seconds: 3 },
      hop(HAMMOCK, 0.8, 4),
      hop(SHELF, 0.8, 4),
      hop(LEDGE, 0.9, 5),
      hop(PERCH, 1, 6),
      { pose: "settle", seconds: 2.8, once: true },
    ],
    room: {
      title: "THE PERCH",
      line: "A warm, quiet room at the top of the tree. Nobody is working in here.",
    },
  },
  {
    id: "ki",
    slot: "03",
    name: "KI",
    note: "No function yet",
    act: "fly",
    frames: [hoveringFighter],
    sprite: "slot-3",
    width: 72,
    at: [1.7, 7],
    lift: 22,
    pace: 7,
    // Down past the cat tree, along the open space below the court, up its right side and back
    // across the top. It never crosses anything that stands, nor the walker's patrol.
    routine: [
      { pose: "idle", seconds: 4 },
      ...flight([
        [7.4, 12.7],
        [11.6, 16.9],
      ]),
      ...beamShot("right"),
      ...flight([
        [14.9, 14.9],
        [17.8, 12.1],
        [20.1, 9.1],
      ]),
      ...beamShot("left"),
      ...flight([
        [17.4, 4.6],
        [10.4, -2.5],
      ]),
      { pose: "idle", seconds: 4, face: "left" },
      ...flight([
        [6.5, 1.4],
        [4, -0.15],
        [-0.2, 4.1],
      ]),
      { pose: "idle", seconds: 3, face: "right" },
      ...flight([[1.7, 7]]),
    ],
    room: {
      title: "KI",
      line: "Thin air and a long way down. The training ground is empty.",
    },
  },
  {
    id: "watch",
    slot: "04",
    name: "WATCH",
    note: "No function yet",
    act: "vigil",
    frames: [cloakedWatcher],
    sprite: "slot-4",
    width: 70,
    at: TIMERS.left,
    lift: TIMERS.bar,
    room: {
      title: "THE WATCH",
      line: "A rooftop over a sleeping city. No one is on duty tonight.",
    },
  },
  {
    id: "deep",
    slot: "05",
    name: "DEEP",
    note: "No function yet",
    act: "swim",
    frames: [deepRay],
    sprite: "slot-5",
    width: 0,
    centred: true,
    room: {
      title: "THE DEEP",
      line: "Still water far below the platform. Nothing stirs down here.",
    },
  },
  {
    id: "horizon",
    slot: "06",
    name: "HORIZON",
    note: "No function yet",
    act: "spin",
    frames: blackHole,
    sprite: "slot-6",
    width: 228,
    // Far out to the right, alone: at the edge of what the view shows when zoomed all the way
    // out, and off screen until the owner goes looking.
    at: off(1690, 200),
    centred: true,
    room: {
      title: "THE HORIZON",
      line: "The edge of a place nothing comes back from. Nothing has been sent in.",
    },
  },
  // The figures below stand in the open ground and sky round the platform. Their drawings
  // exist only as owner-supplied art; without it each shows a plain box of the same shape.
  {
    id: "prowl",
    slot: "07",
    name: "PROWL",
    note: "No function yet",
    act: "roam",
    frames: placeholder(34, 20),
    sprite: "slot-7",
    width: 170,
    at: LAKESIDE,
    pace: 2.2,
    // Round the lake: in at one end, the length of it with only its sail showing, out onto
    // the near shore at the other, a shake, and back along that shore.
    routine: [
      { pose: "lurk", seconds: 5 },
      { pose: "walk", to: SHORE.east },
      { pose: "wade", to: SHORE.enter, seconds: 4, once: true },
      { pose: "swim", to: SHORE.leave, seconds: 14 },
      { pose: "rise", to: SHORE.out, seconds: 4, once: true },
      { pose: "shake", seconds: 2.8, once: true },
      { pose: "lurk", seconds: 4 },
      ...through("walk", [off(LAKE.x - 20, LAKE.y + 140), LAKESIDE]),
    ],
    room: {
      title: "THE PROWL",
      line: "Something large passed through here. It is not here now.",
      look: ["#0c140f", "#c9b98a", "#b5523a"],
    },
  },
  {
    id: "thirst",
    slot: "08",
    name: "THIRST",
    note: "No function yet",
    act: "loop",
    frames: placeholder(34, 28),
    sprite: "slot-8",
    width: 200,
    // Far out to the left, alone: at the edge of what the view shows when zoomed all the way
    // out, and off screen until the owner goes looking.
    at: off(-830, 300),
    tempo: 0.22,
    room: {
      title: "THE THIRST",
      line: "Shards of light with nothing to feed. Nothing is being consumed.",
      look: ["#120d1c", "#e6c4ff", "#a55cff"],
    },
  },
  {
    id: "court",
    slot: "09",
    name: "COURT",
    note: "No function yet",
    act: "loop",
    frames: placeholder(40, 34),
    sprite: "slot-9",
    width: 290,
    at: off(1070, 390),
    tempo: 0.16,
    room: {
      title: "THE COURT",
      line: "An empty gym after practice. No game is on.",
      look: ["#0a0c0b", "#f2f2f2", "#19b061"],
    },
  },
  {
    id: "cloud",
    slot: "10",
    name: "CLOUD",
    note: "No function yet",
    act: "roam",
    frames: placeholder(26, 19),
    sprite: "slot-10",
    width: 120,
    // High in the sky: above the view until the owner zooms out or looks up.
    at: off(140, -330),
    pace: 1.2,
    tempo: 0.16,
    routine: [
      { pose: "drift", to: off(430, -345), ease: "both" },
      { pose: "drift", seconds: 4 },
      { pose: "drift", to: off(140, -330), ease: "both" },
      { pose: "drift", seconds: 4 },
    ],
    room: {
      title: "THE CLOUD",
      line: "High, soft and quiet. Nothing is carried up here.",
      look: ["#dcecf8", "#27465f", "#3f8fc4"],
    },
  },
  {
    id: "gambit",
    slot: "11",
    name: "GAMBIT",
    note: "No function yet",
    act: "loop",
    frames: placeholder(28, 26),
    sprite: "slot-11",
    width: 150,
    // In the open ground up and to the left, between the platform and the far edge.
    at: off(-470, 120),
    // Slow enough to follow each move of the game.
    tempo: 0.32,
    room: {
      title: "THE GAMBIT",
      line: "A board set for a game nobody is playing.",
      look: ["#1a120a", "#d9c9a3", "#4a6b55"],
    },
  },
  {
    id: "throttle",
    slot: "12",
    name: "THROTTLE",
    note: "No function yet",
    act: "roam",
    frames: placeholder(28, 15),
    sprite: "slot-12",
    width: 120,
    at: off(-40, 700),
    // It idles, pulls away to the right until it is out of sight, and is put back where it
    // began, unseen.
    routine: [
      { pose: "rev", seconds: 3.6, face: "right" },
      { pose: "ride", to: off(1500, 700), seconds: 6, ease: "in" },
      { pose: "gone", seconds: 2.5 },
      { pose: "gone", to: off(-40, 700), seconds: 0.1 },
      { pose: "gone", seconds: 1, face: "right" },
    ],
    room: {
      title: "THE THROTTLE",
      line: "An open road and an idling engine. Nobody is riding.",
      look: ["#0c0d0f", "#9aa3ad", "#ffe36a"],
    },
  },
  {
    id: "drift",
    slot: "13",
    name: "DRIFT",
    note: "No function yet",
    act: "float",
    frames: placeholder(33, 39),
    sprite: "slot-13",
    width: 150,
    // High in the sky, beside the cloud.
    at: off(600, -300),
    tempo: 0.14,
    room: {
      title: "THE DRIFT",
      line: "A cardboard pod riding on its own small flames. It is going nowhere in particular.",
      look: ["#f1e3c0", "#5a4630", "#d9534f"],
    },
  },
  {
    id: "pond",
    slot: "14",
    name: "POND",
    note: "No function yet",
    act: "loop",
    frames: placeholder(31, 20),
    sprite: "slot-14",
    width: 230,
    at: off(1010, 622),
    tempo: 0.18,
    room: {
      title: "THE POND",
      line: "Still water and a slack line. Nothing is biting.",
      look: ["#0e2430", "#cfe6f2", "#5fa9c9"],
    },
  },
  {
    id: "grotto",
    slot: "15",
    name: "GROTTO",
    note: "No function yet",
    act: "loop",
    frames: placeholder(29, 25),
    sprite: "slot-15",
    width: 280,
    // Out past the court, below the far light.
    at: off(1430, 500),
    tempo: 0.16,
    room: {
      title: "THE GROTTO",
      line: "Water going round a rock, and a petal now and then. Nothing else happens here.",
      look: ["#0a1420", "#ffc2e2", "#ee4fa2"],
    },
  },
  {
    id: "pilgrim",
    slot: "16",
    name: "PILGRIM",
    note: "No function yet",
    act: "loop",
    frames: placeholder(38, 26),
    sprite: "slot-16",
    width: 272,
    // On open ground down and to the left, beyond the lake.
    at: off(-640, 640),
    tempo: 0.1,
    room: {
      title: "THE PILGRIM",
      line: "A staff, and forms practised alone. There is no journey under way.",
      look: ["#14110d", "#e2b98c", "#e2b23c"],
    },
  },
  {
    id: "wrath",
    slot: "17",
    name: "WRATH",
    note: "No function yet",
    act: "loop",
    frames: placeholder(23, 39),
    sprite: "slot-17",
    width: 125,
    // Standing alone up and to the right of the platform.
    at: off(1200, -40),
    tempo: 0.11,
    room: {
      title: "THE WRATH",
      line: "Power with nothing to spend it on. Nothing is being done with it.",
      look: ["#060507", "#f6f4ff", "#a8182a"],
    },
  },
  {
    id: "stare",
    slot: "18",
    name: "STARE",
    note: "No function yet",
    act: "loop",
    frames: placeholder(37, 27),
    sprite: "slot-18",
    width: 300,
    // In the dark at the top left, far from everything it is looking at.
    at: off(-560, -170),
    tempo: 0.17,
    room: {
      title: "THE STARE",
      line: "Something patient on a lamp post. It is watching, not acting.",
      look: ["#06080e", "#ffd23a", "#5f7090"],
    },
  },
];

/**
 * The core at the middle of the platform. It is not an agent and has no page. It types at its
 * console and now and then sweeps an arm, which sends the blank panes twice round it.
 */
export const ORACLE: Figure = {
  sprite: "oracle",
  frames: [overseer],
  routine: [
    { pose: "type", seconds: 12 },
    { pose: "swipe", seconds: 1.3, once: true },
    { pose: "type", seconds: 6, cast: true, ease: "both" },
  ],
};

/** Where a routine's loop begins and ends: the last place it goes, if it goes anywhere. */
export function home(routine: readonly Beat[] = []): Point | undefined {
  return routine.reduce<Point | undefined>((last, beat) => beat.to ?? last, undefined);
}

/** A grid point as left and top percentages of the scene, raised by `lift` scene units. */
export function scenePercent(point: Point, lift = 0): [number, number] {
  const [x, y] = iso(point[0], point[1], lift);
  return [(x / SCENE.width) * 100, (y / SCENE.height) * 100];
}
