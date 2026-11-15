// #849 root cause: every inbound message received an acknowledgement, including
// other auto-responders and bulk mail. The deployed worker and copied template
// must suppress those replies and mark acknowledgements as automatic.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import worker from "@/worker/worker";
const source = readFileSync("app/(app)/admin/tabs/EmailTab.tsx", "utf8");
const start = source.indexOf("return `// WARNING:") + "return ".length;
const end = source.indexOf("`;", start) + 1;
const templateCode: string = new Function(`return ${source.slice(start, end)}`)();
const template: typeof worker = new Function(templateCode.replace("export default", "return"))();
for (const [name, handler] of [
  ["worker", worker],
  ["admin template", template],
] as const)
  describe(`#849 ${name} replies`, () => {
    async function inbound(headers: Record<string, string> = {}, from = "guest@example.test") {
      const send = vi.fn().mockResolvedValue({});
      const forward = vi.fn().mockResolvedValue({});
      const message = { from, to: "rsvp@example.test", headers: new Headers(headers), forward };
      await handler.email(message as unknown as Parameters<typeof worker.email>[0], {
        INBOUND_FORWARD_TO: "host@example.test",
        EMAIL: { send },
      });
      return { send, forward };
    }
    it.each<Record<string, string>>([
      { "auto-submitted": "auto-replied" },
      { "Auto-Submitted": "auto-generated" },
      { precedence: "bulk" },
      { precedence: "LIST" },
      { precedence: "junk" },
      { "list-id": "party.example.test" },
      { "list-unsubscribe": "<mailto:list@example.test>" },
      { "x-auto-response-suppress": "All" },
    ])("forwards but never acknowledges automated mail %j", async (headers) => {
      const { send, forward } = await inbound(headers);
      expect(forward).toHaveBeenCalledWith("host@example.test");
      expect(send).not.toHaveBeenCalled();
    });
    it.each(["", "<>", "rsvp@example.test", "host@example.test"])(
      "does not reply to null or self sender %s",
      async (from) => {
        expect((await inbound({}, from)).send).not.toHaveBeenCalled();
      }
    );
    it("marks a normal reply acknowledgement as automatic", async () => {
      const { send, forward } = await inbound({ "auto-submitted": "no", subject: "Question" });
      expect(forward.mock.invocationCallOrder[0]).toBeLessThan(send.mock.invocationCallOrder[0]);
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "guest@example.test",
          headers: { "Auto-Submitted": "auto-replied", "X-Auto-Response-Suppress": "All" },
        })
      );
    });
  });
