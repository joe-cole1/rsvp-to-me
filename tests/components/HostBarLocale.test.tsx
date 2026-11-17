import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@/tests/components/render";
import dutch from "@/messages/nl-NL.json";
import { testTheme } from "./helpers/theme";
const { sendBlast } = vi.hoisted(() => ({ sendBlast: vi.fn() }));
vi.mock("@/app/actions/event", () => ({
  sendBlast,
  sendSmsBlast: vi.fn(),
  saveEventSettings: vi.fn(),
  previewGuestInvitations: vi.fn(),
  sendGuestInvitations: vi.fn(),
}));
import { HostBar } from "@/components/event/HostBar";
import { chromeTheme } from "@/lib/theme";

// Delivery feedback is a status line in the host bar's chrome theme.
const status = chromeTheme(testTheme).status;

describe("localized host messaging", () => {
  it.each([
    [2, "Meldingen: 2 geaccepteerd, 0 overgeslagen, 0 mislukt, 0 onzeker.", status.success.text],
    [0, "Meldingen: 0 geaccepteerd, 2 overgeslagen, 0 mislukt, 0 onzeker.", status.info.text],
  ])(
    "styles Dutch delivery feedback from the result for %i recipients",
    async (sent, message, color) => {
      sendBlast.mockResolvedValue({
        success: true,
        sent,
        summary: { accepted: sent, skipped: 2 - sent, failed: 0, uncertain: 0 },
      });
      render(
        <HostBar
          eventId="event-1"
          eventSlug="party"
          theme={testTheme}
          visibility="PUBLIC"
          channelConfig={{ email: true, sms: false }}
        />,
        { locale: "nl-NL", messages: dutch }
      );
      expect(screen.getByRole("button", { name: "Openbaar" })).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: "Bericht sturen" }));
      fireEvent.change(screen.getByPlaceholderText("Typ je bericht…"), {
        target: { value: "Host-authored message stays verbatim" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Bericht versturen" }));
      await waitFor(() => expect(screen.getByText(message)).toBeVisible());
      expect(screen.getByText(message)).toHaveStyle({ color });
      expect(sendBlast).toHaveBeenCalledWith(
        "event-1",
        "Host-authored message stays verbatim",
        ["ALL"],
        null
      );
    }
  );
});
