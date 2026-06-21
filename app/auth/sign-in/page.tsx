import SignInForm from "./SignInForm";
import { isOpenRegistrationActive } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const openRegistration = await isOpenRegistrationActive();
  return <SignInForm openRegistration={openRegistration} />;
}
