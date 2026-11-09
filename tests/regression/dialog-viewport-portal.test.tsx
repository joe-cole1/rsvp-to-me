// @vitest-environment jsdom
// Root cause (01a1baab): backdrop-filter on EventCard captured the inline
// fixed Dialog, so its overlay covered the card and centered far below the viewport.
import "@testing-library/jest-dom/vitest";
import { it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@/tests/components/render";
import { Dialog } from "@/components/ui/Dialog";
it("escapes filtered ancestors and preserves focus and dismissal", () => {
  const close = vi.fn();
  const ui = render(
    <div data-testid="filtered-card" style={{ backdropFilter: "blur(12px)" }}>
      <Dialog open onClose={close} titleId="portal-title">
        <h2 id="portal-title">Viewport dialog</h2>
        <button>Cancel</button>
        <button>Apply</button>
      </Dialog>
    </div>
  );
  const dialog = screen.getByRole("dialog", { name: "Viewport dialog" });
  expect(dialog.parentElement?.parentElement).toBe(document.body);
  expect(ui.getByTestId("filtered-card").contains(dialog)).toBe(false);
  expect(dialog.parentElement).toHaveStyle({
    position: "fixed",
    inset: 0,
    alignItems: "center",
    justifyContent: "center",
  });
  expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(close).toHaveBeenCalledOnce();
  ui.unmount();
  expect(document.body.style.overflow).not.toBe("hidden");
});
