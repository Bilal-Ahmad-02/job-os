import { useState } from "react";

/**
 * A choice between two named options that this computer remembers. Without a saved choice it
 * starts from `initial`. Storage can be unavailable; the choice then lasts until Oracle closes.
 */
function useSavedChoice<Option extends string>(
  key: string,
  [first, second]: readonly [Option, Option],
  initial: () => Option,
): [Option, () => void] {
  const [choice, setChoice] = useState<Option>(() => {
    try {
      const saved = window.localStorage.getItem(key);
      if (saved === first) return first;
      if (saved === second) return second;
    } catch {
      // Fall through to the starting option.
    }
    return initial();
  });
  return [
    choice,
    () => {
      const next = choice === first ? second : first;
      setChoice(next);
      try {
        window.localStorage.setItem(key, next);
      } catch {
        // Nothing to do: the choice still applies now.
      }
    },
  ];
}

/**
 * Whether the chamber's decorative movement runs, and a switch for it. It starts from the
 * system's reduced-motion preference until the owner chooses.
 */
export function useMotion(): [boolean, () => void] {
  const [motion, toggle] = useSavedChoice<"on" | "off">(
    "oracle.chamber.motion",
    ["on", "off"],
    () =>
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: no-preference)").matches
        ? "on"
        : "off",
  );
  return [motion === "on", toggle];
}

export type Theme = "dark" | "light";

/** The chamber's colours, and a switch for them. Dark until the owner chooses light. */
export function useTheme(): [Theme, () => void] {
  return useSavedChoice<Theme>("oracle.chamber.theme", ["dark", "light"], () => "dark");
}
