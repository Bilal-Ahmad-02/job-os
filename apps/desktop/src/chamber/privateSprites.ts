/**
 * Optional owner-supplied figures from the Git-ignored `private` folder beside this file.
 * They are resolved at build time, so nothing is read from disk or the network at runtime.
 */
const found = import.meta.glob("./private/*.{png,gif,webp}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const formats = ["png", "gif", "webp"] as const;

/** The bundled address of `<name>.<format>` if the owner supplied one, preferring PNG. */
export function pickSprite(files: Record<string, string>, name: string): string | undefined {
  for (const format of formats) {
    const address = files[`./private/${name}.${format}`];
    if (address) return address;
  }
  return undefined;
}

/** The owner's image for a figure, by file name without extension, if one was built in. */
export function privateSprite(name: string): string | undefined {
  return pickSprite(found, name);
}
