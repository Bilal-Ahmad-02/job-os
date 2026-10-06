import { type CSSProperties, useEffect, useRef } from "react";
import Icon from "../Icon";
import ShellHeader from "../ShellHeader";
import type { Agent, Room } from "./agents";

const SHAPES = [1, 2, 3, 4, 5, 6] as const;

/**
 * The page behind a figure that has no function yet. It is a still picture and a few words:
 * it holds no state and makes no request. Each room's look comes from its own stylesheet block.
 */
export default function AgentRoom({
  agent,
  room,
  onChamber,
  onLock,
}: {
  agent: Agent;
  room: Room;
  onChamber: () => void;
  onLock?: (() => void) | undefined;
}) {
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => back.current?.focus(), []);
  return (
    <div
      className="room"
      data-room={agent.id}
      data-look={room.look && "plain"}
      style={
        room.look &&
        ({ "--back": room.look[0], "--ink": room.look[1], "--trim": room.look[2] } as CSSProperties)
      }
    >
      <ShellHeader caption={room.title} onLock={onLock}>
        <button
          className="quiet-button"
          type="button"
          aria-label="Return to the chamber"
          ref={back}
          onClick={onChamber}
        >
          <Icon name="back" />
          Chamber
        </button>
      </ShellHeader>
      <main className="room-stage" aria-labelledby="room-title">
        <div className="room-art" aria-hidden="true">
          {SHAPES.map((shape) => (
            <i key={shape} />
          ))}
        </div>
        <div className="room-words">
          <p className="eyebrow">
            {agent.slot} / {agent.name}
          </p>
          <h1 id="room-title">{room.title}</h1>
          <p className="room-line">{room.line}</p>
          <p className="room-status">
            No agent lives here yet. This page does nothing: it stores nothing, reads none of your
            records and contacts nothing.
          </p>
        </div>
      </main>
    </div>
  );
}
