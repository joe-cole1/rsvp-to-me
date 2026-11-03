"use client";

import { useTranslations } from "next-intl";
import type { NotificationFeedback } from "@/lib/notifications/types";

export function NotificationDeliveryFeedback({ feedback }: { feedback: NotificationFeedback }) {
  const t = useTranslations("Ui.Event.NotificationDeliveryFeedback");
  if (!feedback) return null;
  return (
    <div role="status" aria-live="polite" style={{ marginTop: 12, fontSize: 13, lineHeight: 1.5 }}>
      <p style={{ margin: 0 }}>
        {feedback.status === "failed" ? t("processingFailed") : t("summary", feedback.summary)}
      </p>
      {feedback.status === "completed" && (
        <p style={{ margin: "4px 0 0", opacity: 0.8 }}>
          {feedback.summary.uncertain > 0 ? t("uncertainHint") : t("acceptedHint")}
        </p>
      )}
    </div>
  );
}
