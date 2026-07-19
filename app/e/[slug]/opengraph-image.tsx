import { SOCIAL_IMAGE_SIZE } from "@/lib/event-social";
import { renderEventSocialImage } from "./social-image";

export const alt = "Event invitation on RSVP to Me";
export const size = SOCIAL_IMAGE_SIZE;
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default async function OpenGraphImage({ params }: PageProps<"/e/[slug]">) {
  const { slug } = await params;
  return renderEventSocialImage(slug);
}
