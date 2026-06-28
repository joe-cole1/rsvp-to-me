"use client";

import { useMemo, useState } from "react";
import { Search, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeHighlight from "rehype-highlight";
import type { Components } from "react-markdown";
import { APP_SHELL } from "@/lib/theme";
import "highlight.js/styles/github-dark.css";
import "./DocsPanel.css";

export interface PanelDoc {
  slug: string;
  title: string;
  description: string;
  category: string;
  content: string;
}

export default function DocsPanel({ docs }: { docs: PanelDoc[] }) {
  const [activeSlug, setActiveSlug] = useState(docs[0]?.slug ?? "");
  const [query, setQuery] = useState("");

  const slugSet = useMemo(() => new Set(docs.map((d) => d.slug)), [docs]);

  function selectDoc(slug: string, hash = "") {
    if (!slugSet.has(slug)) return;
    setActiveSlug(slug);
    if (hash) {
      setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" }), 50);
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

  // Group by category, preserving the order categories first appear in the sorted list.
  const grouped = useMemo(() => {
    const list = matches ?? docs;
    const order: string[] = [];
    for (const d of list) if (!order.includes(d.category)) order.push(d.category);
    return order.map((category) => ({
      category,
      items: list.filter((d) => d.category === category),
    }));
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
      // Resolve a relative markdown link (e.g. "email.md", "../admin/email.md")
      // to a doc in this panel by its basename slug.
      const [pathPart, hash = ""] = target.split("#");
      const base = pathPart.split("/").pop()?.replace(/\.md$/, "").toLowerCase();
      if (base && slugSet.has(base)) {
        return (
          <a
            href={`#${base}`}
            onClick={(e) => {
              e.preventDefault();
              selectDoc(base, hash);
            }}
            {...rest}
          >
            {children}
          </a>
        );
      }
      return <span {...rest}>{children}</span>;
    },
  };

  if (docs.length === 0) {
    return (
      <div style={{ color: APP_SHELL.textMuted, fontSize: "14px" }}>
        No documentation is available.
      </div>
    );
  }

  return (
    <div className="docs-panel">
      <aside className="docs-panel-sidebar">
        <div style={{ position: "relative", marginBottom: "16px" }}>
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

        <nav style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
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
                        if (!active)
                          e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)";
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
      </aside>

      <main className="docs-panel-main">
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
  );
}
