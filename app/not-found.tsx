import Link from "next/link";
import { getRequestTranslator } from "@/i18n/server";
import { APP_SHELL_THEME } from "@/lib/theme";
import { buttonProps } from "@/components/ui/Button";
import { StatePage } from "@/components/ui/StatePage";

/** Every `notFound()` and unknown URL: the app shell, never Next's unstyled default. */
export default async function NotFound() {
  const tr = await getRequestTranslator();
  return (
    <StatePage
      title={tr("Ui.Errors.NotFound.title")}
      description={tr("Ui.Errors.NotFound.description")}
      actions={
        <Link href="/" {...buttonProps(APP_SHELL_THEME, { variant: "primary" })}>
          {tr("Ui.Errors.Common.home")}
        </Link>
      }
    />
  );
}
