import { redirect } from "next/navigation";
import { destroySession } from "@/lib/session";

export async function GET() {
  await destroySession();
  redirect("/auth/sign-in");
}
