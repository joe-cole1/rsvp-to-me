"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import {
  CAPTCHA_ERROR_MESSAGE,
  CAPTCHA_RESPONSE_FIELD,
  type CaptchaAction,
} from "@/lib/captcha-types";
import { useCaptcha } from "@/components/ui/CaptchaProvider";

export function CaptchaForm({
  captchaAction,
  action,
  children,
  style,
}: {
  captchaAction: CaptchaAction;
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  const { runWithCaptcha } = useCaptcha();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);

    void runWithCaptcha(captchaAction, (token) => {
      if (token) formData.set(CAPTCHA_RESPONSE_FIELD, token);
      return Promise.resolve(action(formData));
    }).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : CAPTCHA_ERROR_MESSAGE);
    });
  };

  return (
    <form action={action} onSubmit={handleSubmit} style={style}>
      {children}
      {error && (
        <p role="alert" style={{ color: "#f87171", fontSize: "13px", marginTop: "12px" }}>
          {error}
        </p>
      )}
    </form>
  );
}
