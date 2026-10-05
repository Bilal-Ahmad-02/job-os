import { catTree, cloakedWatcher, deepRay, hoveringFighter, investigator } from "./sprites";

/** Scene coordinates: a fixed canvas with a 2:1 isometric grid, origin at the far corner. */
export const SCENE = { width: 872, height: 560 } as const;
export function iso(x: number, y: number, z = 0): [number, number] {
  return [436 + (x - y) * 32, 100 + (x + y) * 16 - z];
}
/** Centre of the platform, where the Oracle core sits. */
export const CORE = { x: 6.5, y: 6.5 } as const;

export type Point = readonly [number, number];
/** A page behind a figure that has no function yet. Each one has its own look and says so. */
export type Room = { title: string; line: string };

/**
 * What a figure does while the hub's motion is on. All of it is decoration.
 * - `route`: walks straight lines between `route` points and stops at some to cast falling stars.
 * - `tree`: a cat sleeps on its tree, wakes, climbs down through the cubby and back up.
 * - `beam`: hovers and now and then fires a beam in a direction chosen at that moment.
 * - `boomerang`: stands watch and now and then throws something that comes back.
 * - `swim`: has no place on the platform and swims a loop beneath the whole space.
 */
export type Act = "route" | "tree" | "beam" | "boomerang" | "swim";

export type Agent = {
  id: string;
  slot: string;
  name: string;
  /** Shown under the name on the figure's tag. */
  note: string;
  act: Act;
  /** Built-in drawing: one frame, or two that alternate while walking. */
  frames: readonly (readonly string[])[];
  /** File name, without extension, of an owner-supplied image that replaces the drawing. */
  sprite: string;
  /** Drawn width in scene units. Unused by the swimmer, which is sized by the space. */
  width: number;
  /** Where its feet are on the platform grid. Absent for the swimmer. */
  at?: Point;
  /** Height above the platform for a figure that hovers. */
  lift?: number;
  /** Corners of a walk on the platform grid, starting and ending at `at`. */
  route?: readonly Point[];
  /** Which corners of the walk it stops at. */
  stops?: readonly number[];
  /** Absent only for the job console, which is the one working module. */
  room?: Room;
};

export const AGENTS: readonly Agent[] = [
  {
    id: "jobs",
    slot: "01",
    name: "JOB.OS",
    note: "Job search / manual, no automation",
    act: "route",
    frames: investigator,
    sprite: "job-os",
    width: 56,
    at: [4.5, 10.5],
    // Round the platform, clear of the core and of every other figure's pad.
    route: [
      [4.5, 10.5],
      [2, 11.2],
      [0.4, 9.5],
      [0.4, 2.5],
      [5, 1],
      [8.5, 3],
      [11.5, 5],
      [12, 8.5],
      [11.8, 12],
      [7.5, 12.2],
    ],
    stops: [1, 6, 9],
  },
  {
    id: "perch",
    slot: "02",
    name: "PERCH",
    note: "No function yet",
    act: "tree",
    frames: [catTree],
    sprite: "slot-2",
    width: 74,
    at: [11, 1.5],
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
    act: "beam",
    frames: [hoveringFighter],
    sprite: "slot-3",
    width: 54,
    at: [2, 7],
    lift: 22,
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
    act: "boomerang",
    frames: [cloakedWatcher],
    sprite: "slot-4",
    width: 54,
    at: [10, 10.5],
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
    room: {
      title: "THE DEEP",
      line: "Still water far below the platform. Nothing stirs down here.",
    },
  },
];

/** A grid point as left and top percentages of the scene, raised by `lift` scene units. */
export function scenePercent(point: Point, lift = 0): [number, number] {
  const [x, y] = iso(point[0], point[1], lift);
  return [(x / SCENE.width) * 100, (y / SCENE.height) * 100];
}
