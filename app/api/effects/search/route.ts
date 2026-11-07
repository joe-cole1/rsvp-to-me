import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { assertHostOrCohost } from "@/lib/auth-guards";
import { rateLimit } from "@/lib/rateLimit";
import { resolveLocale } from "@/i18n/config";
import { effectCatalogSize, searchLibraryIcons } from "@/lib/effect-catalog";
import {
  EFFECT_SEARCH_MAX_QUERY_LENGTH,
  type EffectSearchErrorCode,
  type EffectSearchErrorResponse,
} from "@/lib/effect-catalog-shared";
import { logger } from "@/lib/logger";

// #825: read-only, same-origin search over the local effect icon library for
// the host's Effects editor. No CAPTCHA (nothing is written), but the caller
// must be signed in and a host, co-host or admin of the event, and each user
// gets 120 searches a minute. Responses are private and never cached; they
// carry only one fixed page of summaries — never keywords or SVG bodies.

const RATE_LIMIT = 120;
const RATE_WINDOW_SECONDS = 60;
const NO_STORE = { "Cache-Control": "private, no-store" };

function fail(status: number, error: EffectSearchErrorCode, retryAfter?: number) {
  const body: EffectSearchErrorResponse = retryAfter != null ? { error, retryAfter } : { error };
  return NextResponse.json(body, {
    status,
    headers: retryAfter != null ? { ...NO_STORE, "Retry-After": String(retryAfter) } : NO_STORE,
  });
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return fail(401, "unauthorized");

    const limit = await rateLimit(
      `effect-search:${session.userId}`,
      RATE_LIMIT,
      RATE_WINDOW_SECONDS
    );
    if (!limit.success) {
      const retryAfter = Math.max(1, Math.ceil((limit.reset.getTime() - Date.now()) / 1000));
      return fail(429, "rate_limited", retryAfter);
    }

    const params = request.nextUrl.searchParams;
    const eventId = params.get("eventId");
    if (!eventId || eventId.length > 64) return fail(400, "invalid_request");

    try {
      await assertHostOrCohost(eventId);
    } catch (error) {
      return error instanceof Error && error.message === "Unauthorized"
        ? fail(401, "unauthorized")
        : fail(403, "forbidden");
    }

    const query = (params.get("q") ?? "").trim();
    if (query.length > EFFECT_SEARCH_MAX_QUERY_LENGTH) return fail(400, "invalid_request");

    const rawOffset = params.get("offset") ?? "0";
    if (!/^\d{1,6}$/.test(rawOffset)) return fail(400, "invalid_request");
    const offset = Number(rawOffset);
    if (offset > (await effectCatalogSize())) return fail(400, "invalid_request");

    const result = await searchLibraryIcons({
      query,
      locale: resolveLocale(params.get("locale")),
      offset,
    });
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (error) {
    logger.error("Effect icon search failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return fail(500, "search_failed");
  }
}
