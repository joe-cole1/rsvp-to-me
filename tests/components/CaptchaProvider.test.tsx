import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CaptchaProvider, useCaptcha } from "@/components/ui/CaptchaProvider";
import { CAPTCHA_COOKIE_NAME, CAPTCHA_ERROR_MESSAGE } from "@/lib/captcha-types";

vi.mock("next/script", async () => {
  const React = await import("react");

  return {
    default: function MockScript({ onReady }: { onReady?: () => void }) {
      React.useEffect(() => onReady?.(), [onReady]);
      return null;
    },
  };
});

function SubmitButton({ onSubmit }: { onSubmit: () => Promise<void> }) {
  const { runWithCaptcha } = useCaptcha();
  const [error, setError] = useState("");

  return (
    <>
      <button
        type="button"
        onClick={() => {
          void runWithCaptcha("comment", onSubmit).catch((reason: unknown) => {
            setError(reason instanceof Error ? reason.message : "failed");
          });
        }}
      >
        Submit
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}

describe("CaptchaProvider", () => {
  beforeEach(() => {
    document.cookie = `${CAPTCHA_COOKIE_NAME}=; Max-Age=0; Path=/`;
    delete window.turnstile;
  });

  it("gets a fresh action-bound token before submitting", async () => {
    const submit = vi.fn(async () => {
      expect(document.cookie).toContain(`${CAPTCHA_COOKIE_NAME}=verified-token`);
    });
    let options: Record<string, unknown> = {};

    window.turnstile = {
      render: vi.fn((_container, renderOptions) => {
        options = renderOptions;
        return "widget-1";
      }),
      execute: vi.fn(() => {
        (options.callback as (token: string) => void)("verified-token");
      }),
      remove: vi.fn(),
    };

    render(
      <CaptchaProvider siteKey="site-key">
        <SubmitButton onSubmit={submit} />
      </CaptchaProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    expect(options).toMatchObject({
      sitekey: "site-key",
      action: "comment",
      execution: "execute",
      appearance: "interaction-only",
    });
    expect(window.turnstile.render).toHaveBeenCalledOnce();
    expect(window.turnstile.execute).toHaveBeenCalledWith("widget-1");
    expect(window.turnstile.remove).toHaveBeenCalledWith("widget-1");
  });

  it("does not submit when the challenge fails", async () => {
    const submit = vi.fn(async () => undefined);
    let options: Record<string, unknown> = {};

    window.turnstile = {
      render: vi.fn((_container, renderOptions) => {
        options = renderOptions;
        return "widget-1";
      }),
      execute: vi.fn(() => {
        (options["error-callback"] as () => void)();
      }),
      remove: vi.fn(),
    };

    render(
      <CaptchaProvider siteKey="site-key">
        <SubmitButton onSubmit={submit} />
      </CaptchaProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(CAPTCHA_ERROR_MESSAGE);
    expect(submit).not.toHaveBeenCalled();
  });

  it("bypasses Turnstile for administrators", async () => {
    const submit = vi.fn(async () => undefined);

    render(
      <CaptchaProvider siteKey="site-key" bypass>
        <SubmitButton onSubmit={submit} />
      </CaptchaProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    expect(window.turnstile).toBeUndefined();
  });

  describe("Cloudflare Turnstile Test Sitekeys", () => {
    it("handles visible pass test sitekey 1x00000000000000000000AA", async () => {
      const submit = vi.fn(async () => {
        expect(document.cookie).toContain(`${CAPTCHA_COOKIE_NAME}=XXXX.DUMMY.TOKEN.XXXX`);
      });
      let options: Record<string, unknown> = {};

      window.turnstile = {
        render: vi.fn((_container, renderOptions) => {
          options = renderOptions;
          return "widget-pass";
        }),
        execute: vi.fn(() => {
          (options.callback as (token: string) => void)("XXXX.DUMMY.TOKEN.XXXX");
        }),
        remove: vi.fn(),
      };

      render(
        <CaptchaProvider siteKey="1x00000000000000000000AA">
          <SubmitButton onSubmit={submit} />
        </CaptchaProvider>
      );

      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      await waitFor(() => expect(submit).toHaveBeenCalledOnce());
      expect(options.sitekey).toBe("1x00000000000000000000AA");
    });

    it("handles visible fail test sitekey 2x00000000000000000000AB", async () => {
      const submit = vi.fn(async () => undefined);
      let options: Record<string, unknown> = {};

      window.turnstile = {
        render: vi.fn((_container, renderOptions) => {
          options = renderOptions;
          return "widget-fail";
        }),
        execute: vi.fn(() => {
          (options["error-callback"] as () => void)();
        }),
        remove: vi.fn(),
      };

      render(
        <CaptchaProvider siteKey="2x00000000000000000000AB">
          <SubmitButton onSubmit={submit} />
        </CaptchaProvider>
      );

      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(CAPTCHA_ERROR_MESSAGE);
      expect(submit).not.toHaveBeenCalled();
    });

    it("handles invisible pass test sitekey 1x00000000000000000000BB", async () => {
      const submit = vi.fn(async () => undefined);
      let options: Record<string, unknown> = {};

      window.turnstile = {
        render: vi.fn((_container, renderOptions) => {
          options = renderOptions;
          return "widget-invisible-pass";
        }),
        execute: vi.fn(() => {
          (options.callback as (token: string) => void)("XXXX.DUMMY.TOKEN.XXXX");
        }),
        remove: vi.fn(),
      };

      render(
        <CaptchaProvider siteKey="1x00000000000000000000BB">
          <SubmitButton onSubmit={submit} />
        </CaptchaProvider>
      );

      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      await waitFor(() => expect(submit).toHaveBeenCalledOnce());
      expect(options.sitekey).toBe("1x00000000000000000000BB");
    });

    it("handles invisible fail test sitekey 2x00000000000000000000BB", async () => {
      const submit = vi.fn(async () => undefined);
      let options: Record<string, unknown> = {};

      window.turnstile = {
        render: vi.fn((_container, renderOptions) => {
          options = renderOptions;
          return "widget-invisible-fail";
        }),
        execute: vi.fn(() => {
          (options["error-callback"] as () => void)();
        }),
        remove: vi.fn(),
      };

      render(
        <CaptchaProvider siteKey="2x00000000000000000000BB">
          <SubmitButton onSubmit={submit} />
        </CaptchaProvider>
      );

      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(CAPTCHA_ERROR_MESSAGE);
      expect(submit).not.toHaveBeenCalled();
    });

    it("triggers before and after interactive callbacks for sitekey 3x00000000000000000000FF", async () => {
      const submit = vi.fn(async () => undefined);
      let options: Record<string, unknown> = {};

      window.turnstile = {
        render: vi.fn((_container, renderOptions) => {
          options = renderOptions;
          return "widget-interactive";
        }),
        execute: vi.fn(() => {
          (options["before-interactive-callback"] as () => void)();
          (options["after-interactive-callback"] as () => void)();
          (options.callback as (token: string) => void)("XXXX.DUMMY.TOKEN.XXXX");
        }),
        remove: vi.fn(),
      };

      render(
        <CaptchaProvider siteKey="3x00000000000000000000FF">
          <SubmitButton onSubmit={submit} />
        </CaptchaProvider>
      );

      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      await waitFor(() => expect(submit).toHaveBeenCalledOnce());
      expect(options.sitekey).toBe("3x00000000000000000000FF");
    });
  });
});
