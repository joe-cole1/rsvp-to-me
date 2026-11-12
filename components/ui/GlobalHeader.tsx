"use client";
import { usePathname } from "next/navigation";
import { AppTopNav } from "./AppNav";
import type { DropdownUser } from "./ProfileDropdown";
export default function GlobalHeader({ user }: { user: DropdownUser | null }) {
  const path = usePathname();
  // Over every event route the header is app chrome: one fixed dark bar (#812).
  return <AppTopNav user={user} variant={path.startsWith("/e/") ? "chrome" : "default"} />;
}
