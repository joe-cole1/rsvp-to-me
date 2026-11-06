"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { parseInvitationPaste, type PastedRecipient } from "@/lib/invitation-paste";
import type { ResolvedTheme } from "@/lib/theme";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { mutedText, panelStyle } from "./styles";

export function PasteListPanel({
  theme,
  onAdd,
  onCancel,
  onSpreadsheetPaste,
}: {
  theme: ResolvedTheme;
  onAdd: (recipients: PastedRecipient[]) => void;
  onCancel: () => void;
  onSpreadsheetPaste: (text: string) => void;
}) {
  const t = useTranslations("Ui.Event.InvitationComposer");
  const [text, setText] = useState("");
  const pasted = parseInvitationPaste(text);
  const count = pasted.rows.length;
  return (
    <section aria-label={t("pasteList")} style={panelStyle(theme)}>
      <label style={{ display: "grid", gap: "6px" }}>
        <strong>{t("pasteListLabel")}</strong>
        <span style={mutedText(theme)}>
          {t("pasteListHelp", { example: "Alex Rivera <alex@example.com>" })}
        </span>
        <Textarea
          theme={theme}
          autoFocus
          rows={6}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onPaste={(event) => {
            const pastedText = event.clipboardData.getData("text");
            if (pastedText.includes("\t")) {
              event.preventDefault();
              onSpreadsheetPaste(pastedText);
            }
          }}
        />
      </label>
      <p role="status" style={{ ...mutedText(theme), margin: 0 }}>
        {pasted.tooLong ? t("tooLong") : t("found", { count })}
      </p>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <Button
          theme={theme}
          variant="primary"
          type="button"
          disabled={!count}
          onClick={() => onAdd(pasted.rows)}
        >
          {t("addFound", { count })}
        </Button>
        <Button theme={theme} variant="secondary" type="button" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </section>
  );
}
