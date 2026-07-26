"use client";

import Script from "next/script";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  CAPTCHA_COOKIE_NAME,
  CAPTCHA_ERROR_MESSAGE,
  type CaptchaAction,
} from "@/lib/captcha-types";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: Record<string, string | boolean | ((value?: string) => void)>
  ) => string;
  execute: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type CaptchaContextValue = {
  runWithCaptcha: <T>(action: CaptchaAction, submit: () => Promise<T>) => Promise<T>;
};

const CaptchaContext = createContext<CaptchaContextValue>({
  runWithCaptcha: async (_action, submit) => submit(),
});

async function waitForTurnstile(container: HTMLDivElement | null): Promise<TurnstileApi> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (window.turnstile && container) return window.turnstile;
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
  throw new Error(CAPTCHA_ERROR_MESSAGE);
}

function setCaptchaCookie(token: string) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CAPTCHA_COOKIE_NAME}=${token}; Path=/; Max-Age=300; SameSite=Strict${secure}`;
}

export function CaptchaProvider({
  siteKey,
  bypass = false,
  children,
}: {
  siteKey: string | null;
  bypass?: boolean;
  children: ReactNode;
}) {
  const enabled = !!siteKey && !bypass;
  const [interactive, setInteractive] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const submissionPendingRef = useRef(false);

  const executeCaptcha = useCallback(
    async (action: CaptchaAction): Promise<string | null> => {
      if (!enabled) return null;
      const turnstile = await waitForTurnstile(containerRef.current);

      return new Promise<string>((resolve, reject) => {
        let widgetId = "";
        let settled = false;

        const cleanup = () => {
          if (widgetId) {
            turnstile.remove(widgetId);
          }
          setInteractive(false);
        };
        const succeed = (token?: string) => {
          if (settled || !token) return;
          settled = true;
          cleanup();
          resolve(token);
        };
        const fail = () => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(new Error(CAPTCHA_ERROR_MESSAGE));
        };

        try {
          widgetId = turnstile.render(containerRef.current!, {
            sitekey: siteKey!,
            action,
            execution: "execute",
            appearance: "interaction-only",
            theme: "auto",
            retry: "auto",
            "refresh-expired": "auto",
            callback: succeed,
            "error-callback": fail,
            "expired-callback": fail,
            "timeout-callback": fail,
            "before-interactive-callback": () => setInteractive(true),
            "after-interactive-callback": () => setInteractive(false),
          });
          turnstile.execute(widgetId);
        } catch {
          fail();
        }
      });
    },
    [enabled, siteKey]
  );

  const runWithCaptcha = useCallback(
    async <T,>(action: CaptchaAction, submit: () => Promise<T>): Promise<T> => {
      if (submissionPendingRef.current) {
        throw new Error("Another submission is already in progress.");
      }
      submissionPendingRef.current = true;
      try {
        const token = await executeCaptcha(action);
        if (token) setCaptchaCookie(token);
        return await submit();
      } finally {
        submissionPendingRef.current = false;
      }
    },
    [executeCaptcha]
  );

  const value = useMemo(() => ({ runWithCaptcha }), [runWithCaptcha]);

  return (
    <CaptchaContext.Provider value={value}>
      {children}
      {enabled && (
        <>
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
            strategy="afterInteractive"
          />
          <div
            aria-hidden={!interactive}
            aria-live="polite"
            style={{
              position: "fixed",
              left: "50%",
              bottom: "24px",
              zIndex: 10000,
              width: "320px",
              minHeight: "72px",
              padding: interactive ? "10px" : 0,
              borderRadius: "12px",
              background: interactive ? "rgba(15, 23, 42, 0.98)" : "transparent",
              boxShadow: interactive ? "0 18px 50px rgba(0, 0, 0, 0.35)" : "none",
              opacity: interactive ? 1 : 0,
              pointerEvents: interactive ? "auto" : "none",
              transform: "translateX(-50%)",
              transition: "opacity 120ms ease",
            }}
          >
            <div ref={containerRef} />
          </div>
        </>
      )}
    </CaptchaContext.Provider>
  );
}

export function useCaptcha() {
  return useContext(CaptchaContext);
}
