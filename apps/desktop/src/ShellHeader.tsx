import type { ReactNode } from "react";
import Icon from "./Icon";

/** The bar shared by every unlocked screen: brand, a caption, that screen's controls, then Lock. */
export default function ShellHeader({
  caption,
  onLock,
  children,
}: {
  caption: string;
  onLock?: (() => void) | undefined;
  children?: ReactNode;
}) {
  return (
    <header className="console-header">
      <div className="console-brand">
        <img src="/oracle.png" width="32" height="32" alt="" />
        <span>ORACLE</span>
        <small>{caption}</small>
      </div>
      <div className="header-actions">
        {children}
        {onLock ? (
          <button className="quiet-button" type="button" onClick={onLock}>
            <Icon name="lock" />
            Lock Oracle
          </button>
        ) : null}
      </div>
    </header>
  );
}
