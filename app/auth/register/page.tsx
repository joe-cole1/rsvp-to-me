import type { Metadata } from "next";
import RegisterForm from "./RegisterForm";
import { isOpenRegistrationActive } from "@/lib/auth";

export const metadata: Metadata = { title: "Create Account" };

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const openRegistration = await isOpenRegistrationActive();
  return <RegisterForm openRegistration={openRegistration} />;
}
