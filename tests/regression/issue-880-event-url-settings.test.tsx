// #880 root cause: hosts could not edit or rotate predictable event addresses.
// The rendered editor now makes guessability/link-break choices explicit and
// keeps confirmed URL/visibility state until a successful server response.
// @vitest-environment jsdom
import React, { useState } from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@/tests/components/render";
import { EventUrlSettings } from "@/components/event/settings-page/EventUrlSettings";
import { APP_SHELL, resolveTheme } from "@/lib/theme";
import type { EventVisibility, SaveEventUrlInput } from "@/lib/event-url-shared";
const m = vi.hoisted(() => ({ save: vi.fn(), preview: vi.fn(), replace: vi.fn() }));
vi.mock("@/app/actions/event", () => ({ saveEventUrl: m.save, previewEventUrl: m.preview }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: m.replace }) }));
const t = resolveTheme("DARK", "#7c3aed", "#1e40af", "#a855f7");
function Editor({
  slug = "K7m2Qa",
  code = "K7m2Qa",
  mode = "UNLISTED",
  theme = t,
}: {
  slug?: string;
  code?: string | null;
  mode?: EventVisibility;
  theme?: typeof t;
}) {
  const [visibility, setVisibility] = useState(mode);
  return (
    <EventUrlSettings
      eventId="event"
      initialSlug={slug}
      initialRandomCode={code}
      visibility={visibility}
      onVisibilitySaved={setVisibility}
      theme={theme}
    />
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  m.preview.mockResolvedValue({ slug: "thanksgiving-N8p3Rb", code: "N8p3Rb", proof: "proof" });
  m.save.mockImplementation(async (_id: string, input: SaveEventUrlInput) => ({
    success: true,
    slug: input.slug,
    visibility: input.visibility,
    randomCode: input.slug.endsWith("K7m2Qa") ? "K7m2Qa" : input.generatedProof ? "N8p3Rb" : null,
  }));
});
afterEach(cleanup);
const field = () => screen.getByRole("textbox", { name: "Event URL" });
function draft(value: string) {
  fireEvent.change(field(), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Save URL" }));
}
async function changeDialog() {
  return screen.findByRole("dialog", { name: "Change event URL?" });
}
describe("#880 rendered event URL choices", () => {
  it.each(["DARK", "SOFT", "BOLD"] as const)(
    "keeps %s dialogs on the solid app chrome surface",
    async (base) => {
      render(<Editor theme={resolveTheme(base, "#facc15", "#fb923c", "#7c3aed")} />);
      draft("family-dinner");
      const dialog = await screen.findByRole("dialog", { name: "This link may be easy to guess" });
      expect(dialog).toHaveStyle({
        backgroundColor: APP_SHELL.chromeSurface,
        borderColor: APP_SHELL.navBorder,
      });
    }
  );
  it("shows a generated code and previews a readable prefix before confirmation", async () => {
    render(<Editor />);
    expect(field()).toHaveValue("K7m2Qa");
    draft("thanksgiving-K7m2Qa");
    const dialog = await changeDialog();
    expect(within(dialog).getByText("/e/thanksgiving-K7m2Qa")).toBeVisible();
    expect(m.save).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Change URL" }));
    await waitFor(() =>
      expect(m.replace).toHaveBeenCalledWith("/e/thanksgiving-K7m2Qa/settings?section=privacy")
    );
  });
  it("lets an Unlisted host cancel, retain a custom address, or add a random code", async () => {
    render(<Editor />);
    draft("thanksgiving");
    let dialog = await screen.findByRole("dialog", { name: "This link may be easy to guess" });
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(m.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save URL" }));
    dialog = await screen.findByRole("dialog", { name: "This link may be easy to guess" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Use this URL" }));
    dialog = await changeDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(m.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save URL" }));
    dialog = await screen.findByRole("dialog", { name: "This link may be easy to guess" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add random code" }));
    dialog = await changeDialog();
    expect(field()).toHaveValue("thanksgiving-N8p3Rb");
    fireEvent.click(within(dialog).getByRole("button", { name: "Change URL" }));
    await waitFor(() =>
      expect(m.save).toHaveBeenCalledWith(
        "event",
        expect.objectContaining({
          slug: "thanksgiving-N8p3Rb",
          generatedProof: "proof",
          allowGuessable: false,
          confirmLinkChange: true,
        }),
        null
      )
    );
  });
  it.each(["PUBLIC", "PRIVATE"] as const)(
    "allows a custom %s name without a guessability warning",
    async (mode) => {
      render(<Editor mode={mode} />);
      draft("family-dinner");
      expect(await changeDialog()).toBeVisible();
      expect(screen.queryByText("This link may be easy to guess")).not.toBeInTheDocument();
    }
  );
  it("keeps Public selected until the host confirms an Unlisted custom address", async () => {
    render(<Editor slug="thanksgiving" code={null} mode="PUBLIC" />);
    fireEvent.click(screen.getByRole("radio", { name: /Unlisted/ }));
    const dialog = await screen.findByRole("dialog", { name: "This link may be easy to guess" });
    expect(screen.getByRole("radio", { name: /Public/ })).toBeChecked();
    expect(m.save).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Use this URL" }));
    await waitFor(() => expect(screen.getByRole("radio", { name: /Unlisted/ })).toBeChecked());
    expect(m.save).toHaveBeenCalledWith(
      "event",
      expect.objectContaining({
        slug: "thanksgiving",
        visibility: "UNLISTED",
        allowGuessable: true,
        confirmLinkChange: false,
      }),
      null
    );
  });
  it("keeps the confirmed visibility and retry control after failure", async () => {
    m.save.mockResolvedValueOnce({ success: false, error: "stale" });
    render(<Editor />);
    fireEvent.click(screen.getByRole("radio", { name: /Private/ }));
    await screen.findByRole("alert");
    expect(screen.getByRole("radio", { name: /Unlisted/ })).toBeChecked();
    expect(field()).toHaveValue("K7m2Qa");
    fireEvent.click(screen.getByRole("radio", { name: /Private/ }));
    await waitFor(() => expect(screen.getByRole("radio", { name: /Private/ })).toBeChecked());
  });
  it("previews a generated replacement without saving and reports generation failures", async () => {
    render(<Editor />);
    m.preview.mockRejectedValueOnce(new Error("offline"));
    fireEvent.click(screen.getByRole("button", { name: "Generate new link" }));
    await screen.findByRole("alert");
    expect(field()).toHaveValue("K7m2Qa");
    fireEvent.click(screen.getByRole("button", { name: "Generate new link" }));
    await waitFor(() => expect(field()).toHaveValue("thanksgiving-N8p3Rb"));
    expect(m.save).not.toHaveBeenCalled();
  });
  it("disables repeated submissions until a pending visibility save completes", async () => {
    let finish!: (value: unknown) => void;
    m.save.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    render(<Editor />);
    fireEvent.click(screen.getByRole("radio", { name: /Private/ }));
    await waitFor(() => expect(field()).toBeDisabled());
    expect(screen.getByRole("radio", { name: /Public/ })).toBeDisabled();
    await act(async () =>
      finish({ success: true, slug: "K7m2Qa", visibility: "PRIVATE", randomCode: "K7m2Qa" })
    );
    expect(field()).toBeEnabled();
  });
});
