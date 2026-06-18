import RegisterForm from "./RegisterForm";
import { isOpenRegistrationActive } from "@/lib/auth";

export default async function RegisterPage() {
  const openRegistration = await isOpenRegistrationActive();
  return <RegisterForm openRegistration={openRegistration} />;
}
