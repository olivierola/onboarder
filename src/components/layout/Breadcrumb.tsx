"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname }                  from "next/navigation";
import Link                             from "next/link";
import { ChevronRight, Home, Search, Settings, HelpCircle, X } from "lucide-react";
import { createClient }                 from "@/lib/supabase";

const PAGE_LABELS: Record<string, string> = {
  source:    "Sources de code",
  crawl:     "Crawl local",
  knowledge: "Knowledge Base",
  analytics: "Analytics",
  config:    "Configuration",
  install:   "Installation",
  settings:  "Paramètres",
};

interface Props { projectId: string; projectName: string }

function getActiveOrgId(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)onboarder_org_id=([^;]+)/);
  return m ? m[1] : null;
}

export function BreadcrumbBar({ projectId, projectName }: Props) {
  const pathname               = usePathname();
  const [orgName, setOrgName]  = useState<string>("");
  const [search,  setSearch]   = useState("");
  const [focused, setFocused]  = useState(false);
  const inputRef               = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const orgId = getActiveOrgId();
    if (!orgId) return;
    createClient()
      .from("onboarder_organizations")
      .select("name")
      .eq("id", orgId)
      .single()
      .then(({ data }) => { if (data) setOrgName(data.name); });
  }, []);

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const segments  = pathname.split("/").filter(Boolean);
  const pageSlug  = segments[2] ?? null;
  const pageLabel = pageSlug ? (PAGE_LABELS[pageSlug] ?? pageSlug) : "Vue d'ensemble";

  const crumbs = [
    ...(orgName ? [{ label: orgName, href: "/orgs" }] : []),
    { label: projectName, href: "/projects" },
    { label: pageLabel,   href: null },
  ];

  return (
    <nav className="h-14 bg-black px-4 flex items-center gap-3 shrink-0">

      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/projects"
          className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white/40 hover:text-white/80 transition-all"
        >
          <Home className="w-3.5 h-3.5" />
        </Link>

        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <span key={i} className="flex items-center gap-2">
              <ChevronRight className="w-3 h-3 text-white/15 shrink-0" />
              {isLast ? (
                <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-white/[0.10] text-white text-xs font-medium border border-white/[0.10]">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href!}
                  className="inline-flex items-center px-2.5 py-1 rounded-md text-white/40 hover:text-white/80 hover:bg-white/[0.06] text-xs font-medium transition-all border border-transparent hover:border-white/[0.08] max-w-[120px] truncate"
                >
                  {crumb.label}
                </Link>
              )}
            </span>
          );
        })}
      </div>

      <div className="flex-1" />

      {/* ── Right side ── */}
      <div className="flex items-center gap-2">

        {/* Search bar */}
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all w-52 ${
          focused
            ? "bg-white/[0.10] border-white/30"
            : "bg-white/[0.07] border-white/[0.15] hover:bg-white/[0.09] hover:border-white/25"
        }`}>
          <Search className="w-3.5 h-3.5 text-white/60 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Rechercher…"
            className="flex-1 bg-transparent text-xs text-white placeholder-white/40 outline-none min-w-0"
          />
          {search ? (
            <button onClick={() => setSearch("")} className="text-white/50 hover:text-white transition-colors">
              <X className="w-3 h-3" />
            </button>
          ) : (
            <span className="text-[10px] text-white/35 font-mono shrink-0 border border-white/15 px-1 py-0.5 rounded">⌘K</span>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-white/10" />

        {/* Settings */}
        <Link
          href={`/dashboard/${projectId}/config`}
          title="Paramètres"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/[0.10] border border-transparent hover:border-white/15 transition-all"
        >
          <Settings className="w-4 h-4" />
        </Link>

        {/* Help */}
        <button
          title="Aide"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/[0.10] border border-transparent hover:border-white/15 transition-all"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
}
