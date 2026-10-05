import { type PointerEvent, useRef, useState } from "react";
import OracleMark from "./OracleMark";

/** Signed relative turns, in 30-degree stops. No timing enters the credential. */
export function angleDelta(previous: number, next: number): number {
  return ((next - previous + 540) % 360) - 180;
}
export function validSequence(steps: readonly number[]): boolean {
  return (
    steps.length >= 4 &&
    steps.length <= 8 &&
    steps.every(
      (step, i) =>
        Number.isInteger(step) &&
        step !== 0 &&
        Math.abs(step) <= 24 &&
        (i === 0 || Math.sign(step) !== Math.sign(steps[i - 1] ?? 0)),
    )
  );
}
type Props = {
  disabled: boolean;
  onChange: (steps: number[]) => void;
  /** Enter with no turn in progress asks the owner of the dial to submit the sequence. */
  onSubmit?: () => void;
};
export default function RotationDial({ disabled, onChange, onSubmit }: Props) {
  const [steps, setSteps] = useState<number[]>([]);
  const [turn, setTurn] = useState(0);
  const [notice, setNotice] = useState("");
  const movement = useRef({ pointer: -1, previous: 0, degrees: 0 });
  const angle = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return (
      (Math.atan2(
        event.clientY - box.top - box.height / 2,
        event.clientX - box.left - box.width / 2,
      ) *
        180) /
      Math.PI
    );
  };
  function commit(value: number) {
    setTurn(0);
    if (!value) return;
    if (
      Math.abs(value) > 24 ||
      (steps.length > 0 && Math.sign(value) === Math.sign(steps.at(-1) ?? 0))
    ) {
      setNotice("Alternate direction. Use 1 to 24 stops per turn.");
      return;
    }
    const next = [...steps, value];
    setSteps(next);
    onChange(next);
    setNotice("");
  }
  const unavailable = disabled || steps.length === 8;
  return (
    <div className="dial-assembly">
      <div
        className="dial"
        role="slider"
        tabIndex={unavailable ? -1 : 0}
        aria-label="Rotation dial"
        aria-valuemin={-24}
        aria-valuemax={24}
        aria-valuenow={turn}
        aria-valuetext={`${Math.abs(turn)} stops ${turn < 0 ? "counterclockwise" : "clockwise"}`}
        aria-disabled={unavailable}
        aria-describedby="dial-help"
        onPointerDown={(event) => {
          if (unavailable || !event.isPrimary || event.button !== 0) return;
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          movement.current = { pointer: event.pointerId, previous: angle(event), degrees: 0 };
          setTurn(0);
        }}
        onPointerMove={(event) => {
          const state = movement.current;
          if (unavailable || event.pointerId !== state.pointer) return;
          const next = angle(event);
          state.degrees = Math.max(
            -720,
            Math.min(720, state.degrees + angleDelta(state.previous, next)),
          );
          state.previous = next;
          setTurn(Math.round(state.degrees / 30));
        }}
        onPointerUp={(event) => {
          if (event.pointerId !== movement.current.pointer) return;
          const value = Math.round(movement.current.degrees / 30);
          movement.current.pointer = -1;
          event.currentTarget.releasePointerCapture(event.pointerId);
          if (!unavailable) commit(value);
        }}
        onLostPointerCapture={() => {
          movement.current.pointer = -1;
          setTurn(0);
        }}
        onPointerCancel={() => {
          movement.current.pointer = -1;
          setTurn(0);
        }}
        onKeyDown={(event) => {
          // Checked before the eight-turn limit, which disables turning but not submitting.
          if (event.key === "Enter" && !disabled && turn === 0 && movement.current.pointer === -1) {
            event.preventDefault();
            onSubmit?.();
            return;
          }
          if (unavailable || movement.current.pointer !== -1) return;
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            event.preventDefault();
            setTurn((value) =>
              Math.max(-24, Math.min(24, value + (event.key === "ArrowRight" ? 1 : -1))),
            );
          } else if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            commit(turn);
          } else if (event.key === "Escape") {
            setTurn(0);
          }
        }}
      >
        <div
          className="dial-rotor"
          style={{ transform: `rotate(${(steps.reduce((a, b) => a + b, 0) + turn) * 30}deg)` }}
        >
          <OracleMark />
        </div>
        <span className="dial-index" aria-hidden="true" />
      </div>
      <div className="dial-readout" role="status">
        {notice ||
          (turn
            ? `${turn > 0 ? "CW" : "CCW"} / ${String(Math.abs(turn)).padStart(2, "0")}`
            : `${steps.length} / 8 TURNS`)}
      </div>
      <p id="dial-help">
        Drag and release each turn, then press Enter. Keyboard: ← / →, then Space.
      </p>
    </div>
  );
}
