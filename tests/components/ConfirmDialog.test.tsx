// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { useState } from "react";
import { act, fireEvent, render, screen } from "@/tests/components/render";
import { testTheme } from "./helpers/theme";
import { useConfirm } from "@/components/ui/ConfirmDialog";

function Harness() {
  const { confirm, dialog } = useConfirm(testTheme);
  const [result, setResult] = useState("none");
  return (
    <>
      <button
        type="button"
        onClick={async () => {
          const ok = await confirm({
            title: "Remove this guest?",
            message: "This can't be undone.",
            confirmLabel: "Remove",
          });
          setResult(ok ? "confirmed" : "cancelled");
        }}
      >
        Remove guest
      </button>
      <output>{result}</output>
      {dialog}
    </>
  );
}

function open() {
  render(<Harness />);
  const trigger = screen.getByRole("button", { name: "Remove guest" });
  trigger.focus();
  fireEvent.click(trigger);
  return trigger;
}

describe("useConfirm", () => {
  it("opens a named, described dialog with focus on Cancel", () => {
    open();
    const dialog = screen.getByRole("dialog", { name: "Remove this guest?" });
    const describedBy = dialog.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toBe("This can't be undone.");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
  });

  it("resolves true when the action is chosen and closes", async () => {
    open();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("confirmed");
  });

  it("resolves false on Cancel and on Escape, and returns focus to the trigger", async () => {
    const trigger = open();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    });
    expect(screen.getByRole("status").textContent).toBe("cancelled");
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeTruthy();
    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("cancelled");
  });
});
