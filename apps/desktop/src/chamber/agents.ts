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
} from "./sprites";

/** Scene coordinates: a fixed canvas with a 2:1 isometric grid, origin at the far corner. */
export const SCENE = { width: 872, height: 560 } as const;
export function iso(x: number, y: number, z = 0): [number, number] {
  return [436 + (x - y) * 32, 100 + (x + y) * 16 - z];
}
/** Centre of the platform, where the Oracle core sits. */
export const CORE = { x: 6.5, y: 6.5 } as const;
/** The two sand timers, and how far above the floor the bar across each one's posts is. */
export const TIMERS = { left: [-1.5, 8.3], right: [14.8, 7.2], bar: 134 } as const;

export type Point = readonly [number, number];
/** A page behind a figure that has no function yet. Each one has its own look and says so. */
export type Room = { title: string; line: string };

/**
 * What a figure does while the hub's motion is on. All of it is decoration.
 * - `walk`: goes round the platform on foot and stops to call down falling stars.
 * - `tree`: a cat lives on a cat tree: sleeps, stretches, jumps down, hides, climbs back.
 * - `fly`: roams the whole space in the air, pausing to hover or to fire a beam.
 * - `vigil`: stands watch on top of a sand timer.
 * - `swim`: has no place on the platform and swims a loop beneath the whole space.
 * - `spin`: turns on the spot, off the platform.
 */
export type Act = "walk" | "tree" | "fly" | "vigil" | "swim" | "spin";

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
  /** Speed up and slow down instead of keeping a steady pace. */
  glide?: true;
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
  /** Where it stands on the platform grid. Absent for the swimmer. */
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
  /** Absent only for the job console, which is the one working module. */
  room?: Room;
};

/** What the choreography and the drawing need of anything that has poses, agent or not. */
export type Figure = Pick<
  Agent,
  "sprite" | "frames" | "poses" | "prop" | "routine" | "pace" | "lift"
> & { act?: Act };

/** Beats that walk through `points` in turn. */
const through = (pose: string, points: readonly Point[], extra: Partial<Beat> = {}): Beat[] =>
  points.map((to) => ({ pose, to, ...extra }));
const stars: Beat = { pose: "cast", seconds: 7, cast: true };
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
    name: "JOB.OS",
    note: "Job search / manual, no automation",
    act: "walk",
    frames: investigator,
    sprite: "job-os",
    width: 84,
    at: [4.5, 10.5],
    pad: true,
    pace: 1.9,
    // Round the platform, clear of the core and the cat tree, back to its square.
    routine: [
      { pose: "walk", to: [2, 11.2] },
      stars,
      ...through("walk", [
        [0.6, 9.5],
        [0.6, 2.5],
        [5, 1],
        [8, 3.4],
        [11.2, 7],
      ]),
      stars,
      ...through("walk", [
        [11.8, 12],
        [7.5, 12.2],
      ]),
      stars,
      { pose: "walk", to: [4.5, 10.5] },
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
    width: 110,
    at: [11, 1.5],
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
    id: "summit",
    slot: "03",
    name: "SUMMIT",
    note: "No function yet",
    act: "fly",
    frames: [hoveringFighter],
    sprite: "slot-3",
    width: 72,
    at: [2, 7],
    lift: 22,
    pace: 7,
    // Out over the edge of the platform and across the open space on every side of it.
    routine: [
      { pose: "idle", seconds: 5 },
      { pose: "fly", to: [-2.8, 2.4], glide: true },
      { pose: "idle", seconds: 3, face: "right" },
      { pose: "fly", to: [13.4, 1.4], glide: true },
      { pose: "idle", seconds: 4, face: "left" },
      { pose: "fly", to: [15.7, 7.4], glide: true },
      ...beamShot("left"),
      { pose: "fly", to: [10.6, 10.6], glide: true },
      { pose: "idle", seconds: 3 },
      { pose: "fly", to: [5.1, 14.9], glide: true },
      ...beamShot("right"),
      { pose: "fly", to: [2, 7], glide: true },
    ],
    room: {
      title: "THE SUMMIT",
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
    // Off the platform, between its upper right edge and the corner of the space.
    at: [5.1, -2.6],
    centred: true,
    room: {
      title: "THE HORIZON",
      line: "The edge of a place nothing comes back from. Nothing has been sent in.",
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
    { pose: "type", seconds: 6, cast: true, glide: true },
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
