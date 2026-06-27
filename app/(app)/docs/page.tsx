import { redirect } from "next/navigation";
import "highlight.js/styles/github-dark.css";
import "./docs.css";
import { getSessionUser } from "@/lib/session-user";
import { loadVisibleDocs } from "@/lib/docs";
import DocsClient from "./DocsClient";

export const metadata = {
  title: "Documentation",
  description: "RSVP to Me in-app documentation portal",
};

export default async function DocsPage(props: { searchParams: Promise<{ doc?: string }> }) {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role === "GUEST") redirect("/dashboard");

  const docs = await loadVisibleDocs(sessionUser.role);
  if (docs.length === 0) redirect("/dashboard");

  const { doc } = await props.searchParams;
  const initialSlug = docs.some((d) => d.slug === doc) ? doc! : docs[0].slug;

  return <DocsClient docs={docs} initialSlug={initialSlug} />;
}
