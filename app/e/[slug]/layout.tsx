import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildEventSocialMetadata } from "@/lib/event-social";

type EventSlugLayoutProps = {
  children: ReactNode;
  params: Promise<{ slug: string }>;
};

export async function generateMetadata(props: EventSlugLayoutProps): Promise<Metadata> {
  const { slug } = await props.params;

  // Page metadata replaces this for viewable events. Keeping a privacy-safe
  // segment default prevents Next's not-found boundary from falling back to
  // site-wide metadata for missing and cancelled event URLs.
  return buildEventSocialMetadata(null, slug);
}

export default function EventSlugLayout({ children }: EventSlugLayoutProps) {
  return children;
}
