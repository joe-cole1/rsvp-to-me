"use client";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { Languages } from "lucide-react";
import { locales, menuLocales, resolveLocale, type Locale } from "@/i18n/config";
import { setPreferredLocale } from "@/app/actions/locale";
import { APP_SHELL } from "@/lib/theme";

export default function LanguageSelector({
  onLocaleChange,
}: {
  onLocaleChange?: (locale: Locale) => Promise<void>;
}) {
  const locale = resolveLocale(useLocale());
  const t = useTranslations("Ui.Language");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // A long list scrolls inside the menu; keep the current language in view when it opens.
    const current = menu.current?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (open && menu.current && current)
      menu.current.scrollTop =
        current.offsetTop - (menu.current.clientHeight - current.offsetHeight) / 2;
  }, [open]);
  useEffect(() => {
    function outside(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function key(e: KeyboardEvent) {
      if (open && e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    }
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  function choose(value: Locale) {
    startTransition(async () => {
      let displayedLocally = false;
      try {
        if (onLocaleChange) {
          await onLocaleChange(value);
          displayedLocally = true;
        }
        await setPreferredLocale(value);
        setError(false);
        setOpen(false);
        button.current?.focus();
        if (!onLocaleChange) router.refresh();
      } catch {
        if (displayedLocally) {
          setOpen(false);
          button.current?.focus();
        }
        setError(true);
      }
    });
  }
  const flag = (value: Locale) => (
    <Image
      src={locales[value].flag}
      alt=""
      width={28}
      height={28}
      style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }}
    />
  );
  return (
    <div ref={ref} style={{ position: "relative" }}>
      {
        <>
          <button
            ref={button}
            type="button"
            aria-label={t("choose")}
            aria-haspopup="menu"
            aria-expanded={open}
            disabled={pending}
            onClick={() => setOpen(!open)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setOpen(true);
                setTimeout(
                  () =>
                    ref.current
                      ?.querySelector<HTMLButtonElement>('[role="menuitemradio"]')
                      ?.focus(),
                  0
                );
              }
            }}
            style={{
              minWidth: 44,
              height: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: 0,
              padding: 0,
              background: "transparent",
              color: "inherit",
              font: "inherit",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                height: 36,
                padding: "0 10px",
                borderRadius: 18,
                border: `2px solid ${open ? APP_SHELL.accent : APP_SHELL.cardBorder}`,
                background: "rgba(255,255,255,0.06)",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <Languages size={18} aria-hidden="true" />
              {locale.split("-")[0].toUpperCase()}
            </span>
          </button>
          {open && (
            <div
              ref={menu}
              role="menu"
              aria-label={t("label")}
              onKeyDown={(e) => {
                const items = Array.from(
                  e.currentTarget.querySelectorAll<HTMLButtonElement>("button")
                );
                const index = items.indexOf(document.activeElement as HTMLButtonElement);
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  items[
                    (index + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length
                  ]?.focus();
                }
              }}
              style={{
                position: "absolute",
                right: 0,
                top: 48,
                zIndex: 300,
                minWidth: 210,
                maxHeight: "60vh",
                overflowY: "auto",
                overscrollBehavior: "contain",
                padding: 8,
                borderRadius: 12,
                background: "#15151f",
                color: "white",
                border: "1px solid #555",
              }}
            >
              {menuLocales.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={locale === value}
                  lang={value}
                  dir={locales[value].dir}
                  onClick={() => choose(value)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "6px 8px",
                    fontSize: 15,
                    background: "transparent",
                    color: "inherit",
                    border: 0,
                    cursor: "pointer",
                  }}
                >
                  {flag(value)}
                  {locales[value].nativeName}
                  {locale === value && <span aria-hidden="true">✓</span>}
                </button>
              ))}
            </div>
          )}
        </>
      }
      {pending && (
        <span role="status" className="sr-only">
          {t("saving")}
        </span>
      )}
      {error && <span role="alert">{t("error")}</span>}
    </div>
  );
}
