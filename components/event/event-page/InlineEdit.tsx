"use client";

import { useState, useRef } from "react";

// ── Inline editable text ───────────────────────────────────────────────────────

export function InlineEdit({
  value,
  onSave,
  placeholder,
  multiline = false,
  className,
  style,
  isHost,
  outerRef,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder: string;
  multiline?: boolean;
  className?: string;
  style?: React.CSSProperties;
  isHost: boolean;
  outerRef?: React.RefObject<HTMLSpanElement | null>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);

  if (!isHost) {
    return (
      <span className={className} style={style}>
        {value || <span style={{ opacity: 0.4 }}>{placeholder}</span>}
      </span>
    );
  }

  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };

  if (editing) {
    const shared = {
      ref,
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (!multiline && e.key === "Enter") {
          e.preventDefault();
          commit();
        }
        if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
      },
      autoFocus: true,
      style: {
        ...style,
        outline: "none",
        background: multiline ? "rgba(127, 127, 127, 0.08)" : "transparent",
        width: "100%",
        border: multiline ? "1px solid rgba(127, 127, 127, 0.22)" : "none",
        borderRadius: multiline ? "8px" : undefined,
        boxSizing: "border-box" as const,
        fieldSizing: multiline ? ("content" as const) : undefined,
        minHeight: multiline ? "10rem" : undefined,
        maxHeight: multiline ? "min(60dvh, 480px)" : undefined,
        overflowY: multiline ? ("auto" as const) : undefined,
        padding: multiline ? "8px 10px" : undefined,
        resize: multiline ? ("vertical" as const) : ("none" as const),
        fontFamily: "inherit",
        fontSize: "inherit",
        fontWeight: "inherit",
        color: "inherit",
        letterSpacing: "inherit",
      },
      className,
    };
    return multiline ? (
      <textarea rows={6} {...(shared as React.TextareaHTMLAttributes<HTMLTextAreaElement>)} />
    ) : (
      <input {...(shared as React.InputHTMLAttributes<HTMLInputElement>)} />
    );
  }

  return (
    <span
      ref={outerRef}
      className={className}
      style={{ ...style, cursor: "text", borderBottom: "1.5px dashed rgba(255,255,255,0.15)" }}
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      title="Click to edit"
    >
      {value || <span style={{ opacity: 0.35 }}>{placeholder}</span>}
    </span>
  );
}
