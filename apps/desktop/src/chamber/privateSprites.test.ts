import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { AGENTS } from "./agents";
import { pickSprite, privateSprite } from "./privateSprites";

it("picks an owner-supplied figure by exact name, vector art first", () => {
  const files = {
    "./private/job-os.gif": "/assets/job-os-a.gif",
    "./private/job-os.png": "/assets/job-os-b.png",
    "./private/slot-4.png": "/assets/slot-4-d.png",
    "./private/slot-4.svg": "/assets/slot-4-e.svg",
    "./private/oracle.webp": "/assets/oracle-c.webp",
    "./private/job-os-old.png": "/assets/other.png",
  };
  expect(pickSprite(files, "job-os")).toBe("/assets/job-os-b.png");
  expect(pickSprite(files, "oracle")).toBe("/assets/oracle-c.webp");
  expect(pickSprite(files, "slot-4")).toBe("/assets/slot-4-e.svg");
  expect(pickSprite(files, "missing")).toBeUndefined();
  expect(pickSprite({}, "job-os")).toBeUndefined();
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
  for (const name of names) {
    const address = privateSprite(name);
    expect(address === undefined || typeof address === "string").toBe(true);
  }
  expect(privateSprite("not-a-figure")).toBeUndefined();
});
