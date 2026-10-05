/**
 * Optional owner-supplied figures from the Git-ignored `private` folder beside this file.
 * They are resolved at build time, so nothing is read from disk or the network at runtime.
 */
const found = import.meta.glob("./private/*.{svg,png,gif,webp}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

/** A bundled image holding `frames` equal frames side by side. */
export type Strip = { src: string; frames: number };

const formats = ["svg", "png", "gif", "webp"];
/** `name.ext` is a single frame; `name@8.ext` is eight frames in a row. */
const FILE = /^\.\/private\/([^/@]+)(?:@(\d+))?\.(\w+)$/;

/** Every supplied image by figure name. Where formats clash, the earlier one in the list wins. */
export function indexSprites(files: Record<string, string>): Map<string, Strip> {
  const ranked = new Map<string, Strip & { rank: number }>();
  for (const [path, src] of Object.entries(files)) {
    const [, name, frames, format = ""] = FILE.exec(path) ?? [];
    const rank = formats.indexOf(format);
    const held = ranked.get(name ?? "");
    if (!name || rank < 0 || (held && held.rank <= rank)) continue;
    ranked.set(name, { src, frames: Math.max(1, Number(frames ?? 1)), rank });
  }
  return new Map([...ranked].map(([name, { src, frames }]) => [name, { src, frames }]));
}

const supplied = indexSprites(found);

/** The owner's image for a figure or one of its poses, by file name, if one was built in. */
export function privateSprite(name: string): Strip | undefined {
  return supplied.get(name);
}
