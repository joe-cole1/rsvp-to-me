"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/Feedback";
import { APP_SHELL_THEME as T } from "@/lib/theme";

export function ListPagination({
  page,
  hasMore,
  loading,
  error,
  onPage,
  onRetry,
}: {
  page: number;
  hasMore: boolean;
  loading: boolean;
  error: boolean;
  onPage: (page: number) => void;
  onRetry: () => void;
}) {
  const tr = useTranslations("Ui.Admin");
  return (
    <div>
      {error && (
        <InlineAlert theme={T}>
          {tr("listLoadFailed")}{" "}
          <Button theme={T} variant="link" onClick={onRetry}>
            {tr("retryList")}
          </Button>
        </InlineAlert>
      )}
      <nav
        aria-label={tr("listPages")}
        style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}
      >
        <Button
          theme={T}
          variant="secondary"
          disabled={page <= 1 || loading}
          onClick={() => onPage(page - 1)}
        >
          {tr("previousPage")}
        </Button>
        <span role="status" style={{ color: T.textSecondary }}>
          {loading ? tr("loadingList") : tr("listPage", { page })}
        </span>
        <Button
          theme={T}
          variant="secondary"
          disabled={!hasMore || loading || error}
          onClick={() => onPage(page + 1)}
        >
          {tr("nextPage")}
        </Button>
      </nav>
    </div>
  );
}
