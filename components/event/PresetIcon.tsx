import { isLibraryIconIdShape } from "@/lib/effects";
export function PresetIcon({ id, size = 20 }: { id: string; size?: number }) {
  const name = isLibraryIconIdShape(id) ? id.slice(5) : "artist-palette";
  return (
    // Pinned same-origin SVG artwork; next/image would add nothing for it.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/effects/library/noto/1.2.10/${name}.svg`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
    />
  );
}
