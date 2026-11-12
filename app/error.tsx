"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { APP_SHELL_THEME } from "@/lib/theme";
import { Button, buttonProps } from "@/components/ui/Button";
import { StatePage } from "@/components/ui/StatePage";

export default function RootError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("Ui.Errors.Common");
  return (
    <StatePage
      title={t("title")}
      description={t("description")}
      actions={
        <>
          <Button theme={APP_SHELL_THEME} variant="primary" onClick={() => reset()}>
            {t("retry")}
          </Button>
          <Link href="/" {...buttonProps(APP_SHELL_THEME, { variant: "secondary" })}>
            {t("home")}
          </Link>
        </>
      }
    />
  );
}
