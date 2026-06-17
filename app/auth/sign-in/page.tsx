import SignInForm from "./SignInForm";

export default function SignInPage() {
  const openRegistration = process.env.OPEN_REGISTRATION === "true";
  return <SignInForm openRegistration={openRegistration} />;
}
