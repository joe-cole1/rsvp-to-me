import RegisterForm from "./RegisterForm";

export default function RegisterPage() {
  const openRegistration = process.env.OPEN_REGISTRATION === "true";
  return <RegisterForm openRegistration={openRegistration} />;
}
