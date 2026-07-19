// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { InlineEdit } from "@/components/event/event-page/InlineEdit";

describe("InlineEdit", () => {
  it("opens a full-width, content-sized description editor with a mobile height cap", () => {
    render(
      <InlineEdit
        value="A detailed event description"
        onSave={vi.fn()}
        placeholder="Add a description…"
        multiline
        isHost
      />
    );

    fireEvent.click(screen.getByText("A detailed event description"));
    const editor = screen.getByRole("textbox") as HTMLTextAreaElement;

    expect(editor.rows).toBe(6);
    expect(editor.style.width).toBe("100%");
    expect(editor.style.boxSizing).toBe("border-box");
    expect(editor.style.fieldSizing).toBe("content");
    expect(editor.style.minHeight).toBe("10rem");
    expect(editor.style.maxHeight).toBe("min(60dvh, 480px)");
    expect(editor.style.overflowY).toBe("auto");
    expect(editor.style.resize).toBe("vertical");
  });

  it("resets draft on Escape without calling onSave", () => {
    const onSave = vi.fn();
    render(<InlineEdit value="Original title" onSave={onSave} placeholder="Event title" isHost />);

    fireEvent.click(screen.getByText("Original title"));
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Changed title" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.getByText("Original title")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
  });
});
