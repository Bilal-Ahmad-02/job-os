import { type MouseEvent as ReactMouseEvent, type RefObject, useEffect, useState } from "react";

export type View = { scale: number; x: number; y: number };
export const HOME: View = { scale: 1, x: 0, y: 0 };
export const MIN_SCALE = 0.6;
export const MAX_SCALE = 3;
const ZOOM_STEP = 1.15;

/** Keeps the scene within reach: the further in, the further it may be dragged. */
function limited(view: View): View {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale));
  const reach = 520 * scale;
  return {
    scale,
    x: Math.min(reach, Math.max(-reach, view.x)),
    y: Math.min(reach, Math.max(-reach, view.y)),
  };
}
/** Zooms about a point given relative to the centre of the space, so that point stays put. */
function zoomed(view: View, factor: number, px = 0, py = 0): View {
  // Rounded so repeated steps in and out return to exactly the starting size.
  const target = Math.round(view.scale * factor * 10000) / 10000;
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, target));
  const ratio = scale / view.scale;
  return limited({ scale, x: px - (px - view.x) * ratio, y: py - (py - view.y) * ratio });
}

/**
 * Wheel zoom about the pointer and right-button drag for the element in `space`. The left button
 * is left alone so figures can still be pressed. `zoom` and `reset` serve the keyboard buttons.
 */
export function useCamera(space: RefObject<HTMLElement | null>) {
  const [view, setView] = useState<View>(HOME);
  const [panning, setPanning] = useState(false);

  // A native listener is needed to stop the page scrolling while zooming.
  useEffect(() => {
    const element = space.current;
    if (!element) return;
    function wheel(event: WheelEvent) {
      if (!element || event.deltaY === 0) return;
      event.preventDefault();
      const box = element.getBoundingClientRect();
      setView((current) =>
        zoomed(
          current,
          event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP,
          event.clientX - box.left - box.width / 2,
          event.clientY - box.top - box.height / 2,
        ),
      );
    }
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [space]);

  function startPan(event: ReactMouseEvent) {
    if (event.button !== 2) return;
    event.preventDefault();
    const origin = { x: event.clientX - view.x, y: event.clientY - view.y };
    setPanning(true);
    function move(next: MouseEvent) {
      setView((current) =>
        limited({ ...current, x: next.clientX - origin.x, y: next.clientY - origin.y }),
      );
    }
    function stop() {
      setPanning(false);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
    }
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
  }

  return {
    view,
    panning,
    startPan,
    zoom: (direction: 1 | -1) =>
      setView((current) => zoomed(current, direction > 0 ? ZOOM_STEP : 1 / ZOOM_STEP)),
    reset: () => setView(HOME),
  };
}
