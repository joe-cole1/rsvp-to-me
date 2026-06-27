"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Menu, X, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeHighlight from "rehype-highlight";
import type { Components } from "react-markdown";
import { APP_SHELL } from "@/lib/theme";
import { AppShell } from "@/components/ui/AppShell";
import { CATEGORY_ORDER, DOCS } from "@/lib/docs-registry";

interface ClientDoc {
  slug: string;
  title: string;
  description: string;
  category: string;
  content: string;
}

/**
 * Map markdown link targets (e.g. "docs/email.md", "./configuration.md",
 * "README.md") to portal slugs so internal cross-links navigate in-app.
 */
const SLUG_BY_HREF: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const d of DOCS) {
    map[d.file.toLowerCase()] = d.slug; // docs/email.md
    map[d.file.split("/").pop()!.toLowerCase()] = d.slug; // email.md
  }
  return map;
})();

function resolveInternalSlug(href: string): { slug: string; hash: string } | null {
  const [pathPart, hash = ""] = href.split("#");
  const normalized = pathPart.replace(/^\.\//, "").replace(/^\/+/, "").toLowerCase();
  const slug = SLUG_BY_HREF[normalized] ?? SLUG_BY_HREF[normalized.split("/").pop() ?? ""];
  if (!slug) return null;
  return { slug, hash };
}

export default function DocsClient({
  docs,
  initialSlug,
}: {
  docs: ClientDoc[];
  initialSlug: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeSlug, setActiveSlug] = useState(initialSlug);
  const [query, setQuery] = useState("");
  const [navOpen, setNavOpen] = useState(false);

  // Sync active doc from URL (?doc=slug) — back/forward + refresh safe.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const doc = searchParams.get("doc");
    if (doc && docs.some((d) => d.slug === doc)) {
      setActiveSlug(doc);
    }
  }, [searchParams, docs]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function selectDoc(slug: string, hash = "") {
    setActiveSlug(slug);
    setNavOpen(false);
    router.replace(`/docs?doc=${slug}`, { scroll: false });
    if (hash) {
      // Defer until the new doc renders, then jump to the heading anchor.
      setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" }), 50);
    } else {
      window.scrollTo({ top: 0 });
    }
  }

  const activeDoc = docs.find((d) => d.slug === activeSlug) ?? docs[0];

  // Search across titles + content (case-insensitive). Empty query = no filter.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return docs.filter(
      (d) => d.title.toLowerCase().includes(q) || d.content.toLowerCase().includes(q)
    );
  }, [query, docs]);

  // Group visible docs by category in CATEGORY_ORDER, dropping empty groups.
  const grouped = useMemo(() => {
    const list = matches ?? docs;
    return CATEGORY_ORDER.map((category) => ({
      category,
      items: list.filter((d) => d.category === category),
    })).filter((g) => g.items.length > 0);
  }, [matches, docs]);

  const markdownComponents: Components = {
    a({ href, children, ...rest }) {
      const target = href ?? "";
      const isExternal = /^(https?:)?\/\//i.test(target) || target.startsWith("mailto:");
      if (isExternal) {
        return (
          <a href={target} target="_blank" rel="noopener noreferrer" {...rest}>
            {children}
          </a>
        );
      }
      if (target.startsWith("#")) {
        return (
          <a href={target} {...rest}>
            {children}
          </a>
        );
      }
      const internal = resolveInternalSlug(target);
      if (internal) {
        return (
          <a
            href={`/docs?doc=${internal.slug}`}
            onClick={(e) => {
              e.preventDefault();
              selectDoc(internal.slug, internal.hash);
            }}
            {...rest}
          >
            {children}
          </a>
        );
      }
      // Unresolvable relative link (e.g. doc not in the portal) — render inert text.
      return <span {...rest}>{children}</span>;
    },
  };

  const sidebar = (
    <nav style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      {grouped.length === 0 && (
        <div style={{ color: APP_SHELL.textMuted, fontSize: "13px", padding: "8px 4px" }}>
          No matching docs.
        </div>
      )}
      {grouped.map((group) => (
        <div key={group.category}>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: APP_SHELL.textMuted,
              padding: "0 8px 8px",
            }}
          >
            {group.category}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {group.items.map((d) => {
              const active = d.slug === activeSlug;
              return (
                <button
                  key={d.slug}
                  onClick={() => selectDoc(d.slug)}
                  style={{
                    textAlign: "left",
                    border: "none",
                    cursor: "pointer",
                    padding: "9px 12px",
                    borderRadius: "10px",
                    fontSize: "14px",
                    fontWeight: active ? 700 : 600,
                    backgroundColor: active ? APP_SHELL.accent : "transparent",
                    color: active ? "#fff" : APP_SHELL.textSecondary,
                    transition: "background 0.15s, color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  {d.title}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const searchBox = (
    <div style={{ position: "relative", marginBottom: "18px" }}>
      <Search
        size={16}
        style={{
          position: "absolute",
          left: "12px",
          top: "50%",
          transform: "translateY(-50%)",
          color: APP_SHELL.textMuted,
        }}
      />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search docs…"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "9px 12px 9px 36px",
          background: APP_SHELL.inputBg,
          border: `1px solid ${APP_SHELL.inputBorder}`,
          borderRadius: APP_SHELL.inputRadius,
          color: APP_SHELL.textPrimary,
          fontSize: "14px",
          outline: "none",
        }}
      />
    </div>
  );

  return (
    <AppShell>
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "24px 20px 60px",
          display: "flex",
          gap: "32px",
          alignItems: "flex-start",
        }}
      >
        {/* Desktop sidebar */}
        <aside
          className="docs-sidebar-desktop"
          style={{
            width: "260px",
            flexShrink: 0,
            position: "sticky",
            top: "24px",
          }}
        >
          {searchBox}
          {sidebar}
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, minWidth: 0 }}>
          {/* Mobile nav toggle */}
          <button
            className="docs-nav-toggle"
            onClick={() => setNavOpen(true)}
            style={{
              display: "none",
              alignItems: "center",
              gap: "8px",
              marginBottom: "16px",
              padding: "9px 14px",
              background: APP_SHELL.cardBg,
              border: `1px solid ${APP_SHELL.cardBorder}`,
              borderRadius: APP_SHELL.btnRadius,
              color: APP_SHELL.textPrimary,
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Menu size={16} /> Browse docs
          </button>

          <div style={{ marginBottom: "20px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: APP_SHELL.textMuted,
                fontSize: "12px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "6px",
              }}
            >
              <FileText size={13} /> {activeDoc.category}
            </div>
            <div style={{ color: APP_SHELL.textSecondary, fontSize: "14px" }}>
              {activeDoc.description}
            </div>
          </div>

          <article className="md-body">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeSlug, rehypeHighlight]}
              components={markdownComponents}
            >
              {activeDoc.content}
            </ReactMarkdown>
          </article>
        </main>
      </div>

      {/* Mobile slide-in nav drawer */}
      {navOpen && (
        <div
          onClick={() => setNavOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 200,
            display: "flex",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "300px",
              maxWidth: "85%",
              height: "100%",
              overflowY: "auto",
              background: "rgba(18,18,28,0.98)",
              backdropFilter: "blur(16px)",
              borderRight: `1px solid ${APP_SHELL.cardBorder}`,
              padding: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <span style={{ fontWeight: 800, color: APP_SHELL.textPrimary }}>Documentation</span>
              <button
                onClick={() => setNavOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: APP_SHELL.textSecondary,
                  cursor: "pointer",
                }}
              >
                <X size={20} />
              </button>
            </div>
            {searchBox}
            {sidebar}
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 820px) {
          .docs-sidebar-desktop { display: none; }
          .docs-nav-toggle { display: inline-flex !important; }
        }
      `}</style>
    </AppShell>
  );
}
