// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { InlineEdit } from "@/components/event/event-page/InlineEdit";

describe("InlineEdit multiline sizing", () => {
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
});
