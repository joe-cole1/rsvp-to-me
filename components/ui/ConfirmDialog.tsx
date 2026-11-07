"use client";

import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { ResolvedTheme } from "@/lib/theme";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

/**
 * The confirm dialog (docs/engineering/design-language.md, Components → Dialog): a
 * title, one sentence that says what will happen, Cancel and the action. Replaces the
 * browser's `confirm()`, which can't be themed or labeled and blocks the page.
 */
export interface ConfirmOptions {
  /** What is about to happen, as a question: "Remove this RSVP?" */
  title: string;
  /** One sentence on the consequence: "This can't be undone." */
  message: ReactNode;
  /** The action's label, a verb: "Remove". */
  confirmLabel: string;
  /** Destructive actions use the error colors; anything else is a primary action. */
  tone?: "destructive" | "primary";
}

/** The surface the card text is checked on: the card over the page ground. */
export function dialogPanelStyle(t: ResolvedTheme): React.CSSProperties {
  return {
    background: `linear-gradient(${t.cardBg}, ${t.cardBg}), ${t.pageBg}`,
    border: `1px solid ${t.cardBorder}`,
    borderRadius: t.cardRadius,
    boxShadow: t.cardShadow || "0 10px 40px rgba(0,0,0,0.4)",
    color: t.textPrimary,
    padding: "24px",
    maxWidth: "400px",
    boxSizing: "border-box",
  };
}

export function ConfirmDialog({
  theme: t,
  open,
  options,
  onCancel,
  onConfirm,
}: {
  theme: ResolvedTheme;
  open: boolean;
  options: ConfirmOptions | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const common = useTranslations("Ui.Common");
  const titleId = useId();
  const messageId = `${titleId}-message`;
  if (!options) return null;
  const destructive = (options.tone ?? "destructive") === "destructive";
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      titleId={titleId}
      describedBy={messageId}
      panelStyle={dialogPanelStyle(t)}
    >
      <div>
        <h2
          id={titleId}
          style={{ margin: "0 0 8px", fontSize: "15px", fontWeight: 700, color: t.textPrimary }}
        >
          {options.title}
        </h2>
        <p
          id={messageId}
          style={{ margin: "0 0 20px", fontSize: "14px", lineHeight: 1.5, color: t.textSecondary }}
        >
          {options.message}
        </p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", flexWrap: "wrap" }}>
          {/* Cancel comes first so it, not the action, takes the initial focus. */}
          <Button theme={t} variant="secondary" type="button" onClick={onCancel}>
            {common("cancel")}
          </Button>
          <Button
            theme={t}
            variant={destructive ? "destructive" : "primary"}
            type="button"
            onClick={onConfirm}
          >
            {options.confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/**
 * `const { confirm, dialog } = useConfirm(theme)`, render `{dialog}`, then
 * `if (!(await confirm({ … }))) return;` where the code used `window.confirm()`.
 */
export function useConfirm(theme: ResolvedTheme): {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  dialog: ReactNode;
} {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const settle = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOptions(null);
  }, []);

  const confirm = useCallback((next: ConfirmOptions) => {
    // A second request while one is open cancels the first.
    resolver.current?.(false);
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const dialog = (
    <ConfirmDialog
      theme={theme}
      open={options !== null}
      options={options}
      onCancel={() => settle(false)}
      onConfirm={() => settle(true)}
    />
  );

  return { confirm, dialog };
}
