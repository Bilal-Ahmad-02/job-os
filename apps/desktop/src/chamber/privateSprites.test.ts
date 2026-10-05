import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { AGENTS } from "./agents";
import { indexSprites, privateSprite } from "./privateSprites";

it("indexes owner-supplied figures by exact name, vector art first, with their frame counts", () => {
  const found = indexSprites({
    "./private/job-os.gif": "/assets/job-os-a.gif",
    "./private/job-os.png": "/assets/job-os-b.png",
    "./private/job-os-walk@8.png": "/assets/walk.png",
    "./private/slot-4@6.png": "/assets/slot-4-d.png",
    "./private/slot-4.svg": "/assets/slot-4-e.svg",
    "./private/oracle.webp": "/assets/oracle-c.webp",
    "./private/notes.txt": "/assets/notes.txt",
    "./private/make/pix.png": "/assets/nested.png",
  });
  expect(found.get("job-os")).toEqual({ src: "/assets/job-os-b.png", frames: 1 });
  expect(found.get("job-os-walk")).toEqual({ src: "/assets/walk.png", frames: 8 });
  expect(found.get("slot-4")).toEqual({ src: "/assets/slot-4-e.svg", frames: 1 });
  expect(found.get("oracle")).toEqual({ src: "/assets/oracle-c.webp", frames: 1 });
  expect([...found.keys()].sort()).toEqual(["job-os", "job-os-walk", "oracle", "slot-4"]);
  expect(indexSprites({}).size).toBe(0);
});

it("keeps private artwork out of Git", () => {
  const ignore = readFileSync("../../.gitignore", "utf8")
    .split(/\n/)
    .map((line) => line.trim());
  expect(ignore).toContain("/apps/desktop/src/chamber/private/");
  // No rule may re-include anything from the folder.
  expect(ignore.filter((line) => line.startsWith("!") && line.includes("chamber"))).toEqual([]);
});

it("gives every figure its own private file name and falls back when none is supplied", () => {
  const names = [...AGENTS.map((agent) => agent.sprite), "oracle"];
  expect(new Set(names).size).toBe(names.length);
  // One figure's name must not be read as a pose of another.
  for (const name of names)
    expect(names.filter((other) => other !== name && other.startsWith(`${name}-`))).toEqual([]);
  for (const name of names) {
    const strip = privateSprite(name);
    expect(strip === undefined || (typeof strip.src === "string" && strip.frames >= 1)).toBe(true);
  }
  expect(privateSprite("not-a-figure")).toBeUndefined();
});
