"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";

import { createPortal } from "react-dom";
import { APP_SHELL } from "@/lib/theme";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({
  open,
  onClose,
  titleId,
  describedBy,
  children,
  panelStyle,
  overlayStyle,
  closeOnBackdrop = true,
}: {
  open: boolean;
  onClose: () => void;
  titleId: string;
  /** Id of the sentence that says what the dialog is about, read after the title. */
  describedBy?: string;
  children: ReactNode;
  panelStyle?: React.CSSProperties;
  overlayStyle?: React.CSSProperties;
  closeOnBackdrop?: boolean;
}) {
  const mounted = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || !mounted) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Content can name its own starting field; dialog children mount first.
    const panel = panelRef.current;
    (
      panel?.querySelector<HTMLElement>("[data-autofocus]") ??
      panel?.querySelector<HTMLElement>(FOCUSABLE)
    )?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open, mounted]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: APP_SHELL.chromeBackdrop,
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        ...overlayStyle,
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        tabIndex={-1}
        style={{ width: "100%", maxHeight: "90vh", overflowY: "auto", ...panelStyle }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
