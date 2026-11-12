import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserProfile } from "@/app/actions/profile";
import { getRequestTranslator } from "@/i18n/server";
import ProfileClient from "./ProfileClient";
import { getChannelConfig } from "@/lib/config";

// "Profile | RSVP to Me": the root layout's title template adds the brand.
export async function generateMetadata(): Promise<Metadata> {
  const tr = await getRequestTranslator();
  return { title: tr("Ui.Profile.metadataTitle"), description: tr("Ui.Profile.description") };
}

export default async function ProfilePage() {
  const [profile, channelConfig] = await Promise.all([getUserProfile(), getChannelConfig()]);

  if (!profile) {
    redirect("/auth/sign-in");
  }

  return <ProfileClient initialProfile={profile} channelConfig={channelConfig} />;
}
