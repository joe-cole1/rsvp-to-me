import { getLibraryIconSummaries } from "@/lib/effect-catalog";
import type { LibraryIconSummary } from "@/lib/effect-catalog-shared";
import { logger } from "@/lib/logger";
import { presetPresentation } from "@/lib/theme-preset-presentation";

/**
 * Labels the settings Effects editor needs up front: the event's stored
 * mixture plus every preset's default mixture (applying a preset loads it into
 * Your mix). Only these summaries cross to the client, never the catalog.
 * The labels are an editor aid, so a catalog failure degrades to none rather
 * than taking the settings page down (01a1baab).
 */
export async function getEditorIconSummaries(
  storedIconIds: readonly string[],
  presets: readonly { presentation?: unknown }[]
): Promise<LibraryIconSummary[]> {
  const ids = [
    ...new Set([
      ...storedIconIds,
      ...presets.flatMap((p) => presetPresentation(p.presentation).effect?.effectIconIds ?? []),
    ]),
  ];
  try {
    return await getLibraryIconSummaries(ids);
  } catch (error) {
    logger.warn("Effect icon summaries unavailable for the settings editor", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
