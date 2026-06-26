import { redirect } from "next/navigation";
import { getUserProfile } from "@/app/actions/profile";
import ProfileClient from "./ProfileClient";
import { getChannelConfig } from "@/lib/config";

export const metadata = {
  title: "Profile Settings | RSVP",
  description: "Manage your RSVP account and notification preferences.",
};

export default async function ProfilePage() {
  const [profile, channelConfig] = await Promise.all([getUserProfile(), getChannelConfig()]);

  if (!profile) {
    redirect("/auth/sign-in");
  }

  return <ProfileClient initialProfile={profile} channelConfig={channelConfig} />;
}
