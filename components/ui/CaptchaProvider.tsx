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
import { CAPTCHA_ERROR_MESSAGE, type CaptchaAction } from "@/lib/captcha-types";

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
  executeCaptcha: (action: CaptchaAction) => Promise<string | null>;
};

const CaptchaContext = createContext<CaptchaContextValue>({
  executeCaptcha: async () => null,
});

async function waitForTurnstile(container: HTMLDivElement | null): Promise<TurnstileApi> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (window.turnstile && container) return window.turnstile;
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
  throw new Error(CAPTCHA_ERROR_MESSAGE);
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
  const challengeTailRef = useRef<Promise<void>>(Promise.resolve());

  const executeCaptcha = useCallback(
    async (action: CaptchaAction): Promise<string | null> => {
      if (!enabled) return null;

      let releaseChallenge: () => void = () => undefined;
      const previousChallenge = challengeTailRef.current;
      challengeTailRef.current = new Promise<void>((resolve) => {
        releaseChallenge = resolve;
      });

      await previousChallenge;
      try {
        const turnstile = await waitForTurnstile(containerRef.current);

        return await new Promise<string>((resolve, reject) => {
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
      } finally {
        releaseChallenge();
      }
    },
    [enabled, siteKey]
  );

  const value = useMemo(() => ({ executeCaptcha }), [executeCaptcha]);

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
  const { executeCaptcha } = useContext(CaptchaContext);
  const pendingActionsRef = useRef(new Set<CaptchaAction>());

  const runWithCaptcha = useCallback(
    async <T,>(action: CaptchaAction, submit: (token: string | null) => Promise<T>): Promise<T> => {
      if (pendingActionsRef.current.has(action)) {
        throw new Error("This submission is already in progress.");
      }
      pendingActionsRef.current.add(action);
      try {
        const token = await executeCaptcha(action);
        return await submit(token);
      } finally {
        pendingActionsRef.current.delete(action);
      }
    },
    [executeCaptcha]
  );

  return useMemo(() => ({ runWithCaptcha }), [runWithCaptcha]);
}
