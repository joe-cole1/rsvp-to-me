import { z } from "zod";

// Zod 4.5+ measures built-in string bounds in Unicode code points. Keep the
// application's existing UTF-16 code-unit limits (String.length / HTML
// maxlength) without changing standard Zod issue codes, paths, or messages.
// Attach after trimming when the field's existing contract trims first.
export function maxCodeUnits(maximum: number) {
  return z.check<string>((ctx) => {
    if (ctx.value.length > maximum) {
      ctx.issues.push({
        origin: "string",
        code: "too_big",
        maximum,
        inclusive: true,
        input: ctx.value,
        continue: true,
      });
    }
  });
}

export function minCodeUnits(minimum: number) {
  return z.check<string>((ctx) => {
    if (ctx.value.length < minimum) {
      ctx.issues.push({
        origin: "string",
        code: "too_small",
        minimum,
        inclusive: true,
        input: ctx.value,
        continue: true,
      });
    }
  });
}
