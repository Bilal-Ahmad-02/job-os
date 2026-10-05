import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RotationDial, { angleDelta, validSequence } from "./RotationDial";

describe("rotation input", () => {
  it("records a mouse turn on release and discards a cancelled drag", () => {
    class TestPointerEvent extends MouseEvent {
      pointerId = 1;
      isPrimary = true;
    }
    vi.stubGlobal("PointerEvent", TestPointerEvent);
    const changed = vi.fn();
    render(<RotationDial disabled={false} onChange={changed} />);
    const dial = screen.getByRole("slider");
    dial.setPointerCapture = vi.fn();
    dial.releasePointerCapture = vi.fn();
    vi.spyOn(dial, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 200,
      bottom: 200,
      width: 200,
      height: 200,
      toJSON: () => ({}),
    });
    fireEvent.pointerDown(dial, { clientX: 200, clientY: 100, button: 0 });
    fireEvent.pointerMove(dial, { clientX: 100, clientY: 200 });
    expect(changed).not.toHaveBeenCalled();
    fireEvent.pointerUp(dial, { clientX: 100, clientY: 200 });
    expect(changed).toHaveBeenLastCalledWith([3]);
    fireEvent.pointerDown(dial, { clientX: 100, clientY: 200, button: 0 });
    fireEvent.pointerMove(dial, { clientX: 200, clientY: 100 });
    fireEvent.pointerCancel(dial);
    fireEvent.pointerUp(dial);
    expect(changed).toHaveBeenCalledTimes(1);
  });
  it("unwraps crossings without losing clockwise or counterclockwise direction", () => {
    expect(angleDelta(175, -175)).toBe(10);
    expect(angleDelta(-175, 175)).toBe(-10);
    expect(angleDelta(0, 90)).toBe(90);
  });
  it("requires bounded alternating turns", () => {
    expect(validSequence([1, -2, 24, -24])).toBe(true);
    for (const value of [
      [],
      [1, -2, 3],
      [1, 2, -3, 4],
      [0, -2, 3, -4],
      [25, -2, 3, -4],
      [1.5, -2, 3, -4],
    ])
      expect(validSequence(value)).toBe(false);
  });
  it("commits keyboard turns, rejects repeated direction and respects disabled state", () => {
    const changed = vi.fn();
    const view = render(<RotationDial disabled={false} onChange={changed} />);
    const dial = screen.getByRole("slider");
    fireEvent.keyDown(dial, { key: "ArrowRight" });
    fireEvent.keyDown(dial, { key: " " });
    expect(changed).toHaveBeenLastCalledWith([1]);
    fireEvent.keyDown(dial, { key: "ArrowRight" });
    fireEvent.keyDown(dial, { key: " " });
    expect(changed).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(dial, { key: "ArrowLeft" });
    fireEvent.keyDown(dial, { key: " " });
    expect(changed).toHaveBeenLastCalledWith([1, -1]);
    view.rerender(<RotationDial disabled onChange={changed} />);
    fireEvent.keyDown(dial, { key: "ArrowRight" });
    fireEvent.keyDown(dial, { key: " " });
    expect(changed).toHaveBeenCalledTimes(2);
  });
  it("uses Enter to finish a turn in progress, otherwise to ask for submission", () => {
    const changed = vi.fn();
    const submitted = vi.fn();
    render(<RotationDial disabled={false} onChange={changed} onSubmit={submitted} />);
    const dial = screen.getByRole("slider");
    fireEvent.keyDown(dial, { key: "ArrowRight" });
    fireEvent.keyDown(dial, { key: "Enter" });
    expect(changed).toHaveBeenLastCalledWith([1]);
    expect(submitted).not.toHaveBeenCalled();
    fireEvent.keyDown(dial, { key: "Enter" });
    expect(submitted).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenCalledTimes(1);
    // Space never submits.
    fireEvent.keyDown(dial, { key: " " });
    expect(submitted).toHaveBeenCalledTimes(1);
  });
  it("still submits on Enter after the eighth turn and never while disabled", () => {
    const submitted = vi.fn();
    const view = render(<RotationDial disabled={false} onChange={() => {}} onSubmit={submitted} />);
    const dial = screen.getByRole("slider");
    for (let turn = 0; turn < 8; turn += 1) {
      fireEvent.keyDown(dial, { key: turn % 2 ? "ArrowLeft" : "ArrowRight" });
      fireEvent.keyDown(dial, { key: " " });
    }
    expect(dial).toHaveAttribute("aria-disabled", "true");
    fireEvent.keyDown(dial, { key: "Enter" });
    expect(submitted).toHaveBeenCalledTimes(1);
    view.rerender(<RotationDial disabled onChange={() => {}} onSubmit={submitted} />);
    fireEvent.keyDown(dial, { key: "Enter" });
    expect(submitted).toHaveBeenCalledTimes(1);
  });
});
