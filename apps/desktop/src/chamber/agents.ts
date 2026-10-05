import { cloakedWatcher, deepRay, hoveringFighter, investigator, sleepingCat } from "./sprites";

/** Scene coordinates: a fixed canvas with a 2:1 isometric grid, origin at the far corner. */
export const SCENE = { width: 872, height: 560 } as const;
export function iso(x: number, y: number, z = 0): [number, number] {
  return [436 + (x - y) * 32, 100 + (x + y) * 16 - z];
}
/** Centre of the platform, where the Oracle core sits. */
export const CORE = { x: 6.5, y: 6.5 } as const;

/** A page behind a figure that has no function yet. Each one has its own look and says so. */
export type Room = { title: string; line: string };

export type Agent = {
  id: string;
  slot: string;
  name: string;
  /** Shown under the name on the figure's tag. */
  note: string;
  /** Built-in drawing: one frame, or two that alternate while walking. */
  frames: readonly (readonly string[])[];
  /** File name, without extension, of an owner-supplied image that replaces the drawing. */
  sprite: string;
  /** Drawn width in scene units. */
  width: number;
  /** Where its feet are on the platform grid. Absent for the one that swims beneath the space. */
  at?: readonly [number, number];
  /** Height above the platform for a figure that hovers. */
  lift?: number;
  /** Far end of a walk, on the platform grid. */
  walksTo?: readonly [number, number];
  /** Absent only for the job console, which is the one working module. */
  room?: Room;
};

export const AGENTS: readonly Agent[] = [
  {
    id: "jobs",
    slot: "01",
    name: "JOB.OS",
    note: "Job search / manual, no automation",
    frames: investigator,
    sprite: "job-os",
    width: 44,
    at: [4.5, 10.5],
    walksTo: [6.5, 15],
  },
  {
    id: "perch",
    slot: "02",
    name: "PERCH",
    note: "No function yet",
    frames: [sleepingCat],
    sprite: "slot-2",
    width: 66,
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
    frames: [hoveringFighter],
    sprite: "slot-3",
    width: 48,
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
    frames: [cloakedWatcher],
    sprite: "slot-4",
    width: 48,
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
    frames: [deepRay],
    sprite: "slot-5",
    width: 0,
    room: {
      title: "THE DEEP",
      line: "Still water far below the platform. Nothing stirs down here.",
    },
  },
];

/** Feet position as percentages of the scene, for figures that stand on the platform. */
export function footPercent(point: readonly [number, number], lift = 0): [string, string] {
  const [x, y] = iso(point[0], point[1], lift);
  return [`${(x / SCENE.width) * 100}%`, `${(y / SCENE.height) * 100}%`];
}
