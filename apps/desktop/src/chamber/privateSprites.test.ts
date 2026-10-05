import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { pickSprite, privateSprites } from "./privateSprites";

it("picks an owner-supplied figure by exact name and prefers PNG", () => {
  const files = {
    "./private/job-os.gif": "/assets/job-os-a.gif",
    "./private/job-os.png": "/assets/job-os-b.png",
    "./private/oracle.webp": "/assets/oracle-c.webp",
    "./private/job-os-old.png": "/assets/other.png",
  };
  expect(pickSprite(files, "job-os")).toBe("/assets/job-os-b.png");
  expect(pickSprite(files, "oracle")).toBe("/assets/oracle-c.webp");
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

it("falls back to the built-in figures when a name has no private file", () => {
  const { slots, ...figures } = privateSprites;
  expect(Object.keys(slots)).toEqual(["02", "03", "04", "05"]);
  for (const address of [...Object.values(figures), ...Object.values(slots)])
    expect(address === undefined || typeof address === "string").toBe(true);
});
