import { type RefObject, useEffect } from "react";

/**
 * Keeps each dotted line in the overlay running from the orb to its figure's feet. Positions are
 * read from the page, so the lines follow walking, hovering and roaming figures and the camera
 * without any of them needing to know about the lines. While `moving` it redraws every frame;
 * otherwise only when `redrawKey` changes or the space is resized.
 */
export function useLeash(
  space: RefObject<HTMLElement | null>,
  active: boolean,
  moving: boolean,
  redrawKey: unknown,
) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: redrawKey exists to trigger a redraw.
  useEffect(() => {
    const host = space.current;
    const orb = host?.querySelector(".chamber-orb");
    if (!active || !host || !orb) return;
    const pairs = [...host.querySelectorAll<SVGLineElement>(".chamber-leash line")].flatMap(
      (line) => {
        const figure = host.querySelector(`[data-agent="${line.dataset.for}"]`);
        return figure ? [{ line, figure }] : [];
      },
    );
    function draw() {
      if (!host || !orb) return;
      const frame = host.getBoundingClientRect();
      const source = orb.getBoundingClientRect();
      const x1 = source.left + source.width / 2 - frame.left;
      const y1 = source.top + source.height / 2 - frame.top;
      for (const { line, figure } of pairs) {
        const box = figure.getBoundingClientRect();
        line.setAttribute("x1", String(x1));
        line.setAttribute("y1", String(y1));
        // Standing figures are tied by the feet; ones seen from above or adrift, by the middle.
        const hold = (figure as HTMLElement).dataset.centred ? box.height / 2 : box.height;
        line.setAttribute("x2", String(box.left + box.width / 2 - frame.left));
        line.setAttribute("y2", String(box.top + hold - frame.top));
      }
    }
    draw();
    const resize = typeof ResizeObserver === "function" ? new ResizeObserver(draw) : null;
    resize?.observe(host);
    let frameId = 0;
    if (moving) {
      const loop = () => {
        draw();
        frameId = requestAnimationFrame(loop);
      };
      frameId = requestAnimationFrame(loop);
    }
    return () => {
      cancelAnimationFrame(frameId);
      resize?.disconnect();
    };
  }, [space, active, moving, redrawKey]);
}
