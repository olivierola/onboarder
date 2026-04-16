"use client";

import Link                       from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState }    from "react";
import { cn }                     from "@/lib/utils";
import {
  LayoutDashboard, BookOpen, BarChart3, Settings2,
  Code2, Zap, ChevronRight, RefreshCw,
  GitBranch, LogOut, SlidersHorizontal, Workflow,
  Inbox, Ticket, Users, HeadphonesIcon, TrendingUp,
  MessageSquare, KeyRound, Map,
} from "lucide-react";

interface Props    { projectId: string; projectName: string }
interface OrgInfo  { id: string; name: string }
interface UserInfo { email: string }

type SidebarMode = "onboarder" | "helpdesk";

function getActiveOrgId(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)onboarder_org_id=([^;]+)/);
  return m ? m[1] : null;
}

export function Sidebar({ projectId, projectName }: Props) {
  const pathname = usePathname();
  const router   = useRouter();
  const base     = `/dashboard/${projectId}`;

  const [org,  setOrg]  = useState<OrgInfo | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);

  // Auto-detect mode from pathname
  const isHelpdesk = pathname.includes(`${base}/helpdesk`);
  const [mode, setMode] = useState<SidebarMode>(isHelpdesk ? "helpdesk" : "onboarder");

  // Sync mode when route changes
  useEffect(() => {
    setMode(pathname.includes(`${base}/helpdesk`) ? "helpdesk" : "onboarder");
  }, [pathname, base]);

  useEffect(() => {
    import("@/lib/supabase").then(({ createClient }) => {
      const sb = createClient();
      const orgId = getActiveOrgId();
      if (orgId) {
        sb.from("onboarder_organizations").select("id, name").eq("id", orgId).single()
          .then(({ data }) => { if (data) setOrg(data); });
      }
      sb.auth.getUser().then(({ data: { user } }) => {
        if (user) setUser({ email: user.email ?? "" });
      });
    });
  }, []);

  async function signOut() {
    const { createClient } = await import("@/lib/supabase");
    await createClient().auth.signOut();
    router.push("/login");
  }

  function switchMode(m: SidebarMode) {
    setMode(m);
    if (m === "helpdesk") router.push(`${base}/helpdesk/inbox`);
    else router.push(base);
  }

  const onboarderNav = [
    { href: base,                label: "Vue d'ensemble",  icon: LayoutDashboard },
    { href: `${base}/source`,    label: "Sources de code", icon: GitBranch },
    { href: `${base}/crawl`,     label: "Crawl local",     icon: RefreshCw },
    { href: `${base}/knowledge`, label: "Knowledge Base",  icon: BookOpen },
    { href: `${base}/map`,       label: "SaaS Map",        icon: Map },
    { href: `${base}/analytics`, label: "Analytics",       icon: BarChart3 },
    { href: `${base}/config`,    label: "Configuration",   icon: Settings2 },
    { href: `${base}/tokens`,    label: "Tokens d'accès",  icon: KeyRound },
    { href: `${base}/install`,   label: "Installation",    icon: Code2 },
    { href: `${base}/flows`,     label: "Custom Flows",    icon: Workflow },
    { href: `${base}/chat`,      label: "Chat sessions",   icon: MessageSquare },
  ];

  const helpdeskNav = [
    { href: `${base}/helpdesk/inbox`,    label: "Inbox",      icon: Inbox },
    { href: `${base}/helpdesk/sessions`, label: "Sessions",   icon: Users },
    { href: `${base}/helpdesk/tickets`,  label: "Tickets",    icon: Ticket },
    { href: `${base}/helpdesk/analytics`, label: "Analytics", icon: TrendingUp },
  ];

  const nav = mode === "helpdesk" ? helpdeskNav : onboarderNav;

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : "??";

  return (
    <aside className="sidebar-dark w-60 h-screen sticky top-0 flex flex-col overflow-y-auto shrink-0">

      {/* ── Logo / Project header ── */}
      <div className="px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/10 ring-1 ring-white/20 flex items-center justify-center shrink-0">
            {mode === "helpdesk"
              ? <HeadphonesIcon className="w-4 h-4 text-white" />
              : <Zap className="w-4 h-4 text-white" />
            }
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-white/40 font-medium uppercase tracking-widest">Projet</p>
            <p className="text-sm font-semibold text-white truncate leading-tight">{projectName}</p>
          </div>
        </div>
      </div>

      {/* ── Mode switcher ── */}
      <div className="px-3 py-2.5">
        <div className="flex rounded-xl bg-white/[0.05] p-1 gap-1">
          <button
            onClick={() => switchMode("onboarder")}
            className={cn(
              "flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all",
              mode === "onboarder"
                ? "bg-white/[0.14] text-white shadow-sm"
                : "text-white/35 hover:text-white/60"
            )}
          >
            Onboarder
          </button>
          <button
            onClick={() => switchMode("helpdesk")}
            className={cn(
              "flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all",
              mode === "helpdesk"
                ? "bg-white/[0.14] text-white shadow-sm"
                : "text-white/35 hover:text-white/60"
            )}
          >
            Helpdesk
          </button>
        </div>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            (href !== base && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group",
                active
                  ? "bg-white/[0.12] text-white shadow-sm"
                  : "text-white/50 hover:bg-white/[0.06] hover:text-white/90"
              )}
            >
              <Icon className={cn(
                "w-4 h-4 shrink-0 transition-colors",
                active ? "text-white" : "text-white/40 group-hover:text-white/70"
              )} />
              <span className="truncate">{label}</span>
              {active && <ChevronRight className="w-3 h-3 ml-auto text-white/40 shrink-0" />}
            </Link>
          );
        })}
      </nav>

      {/* ── Tous les projets ── */}
      <div className="px-3 pb-3">
        <Link
          href="/projects"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/40 hover:bg-white/[0.06] hover:text-white/80 transition-all group"
        >
          <SlidersHorizontal className="w-4 h-4 shrink-0 text-white/30 group-hover:text-white/60" />
          Tous les projets
        </Link>
      </div>

      {/* ── Profile card ── */}
      <div className="p-3 border-t border-white/[0.07]">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.10] transition-colors group">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0 ring-1 ring-white/20">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white/80 truncate">{user?.email ?? "…"}</p>
            <p className="text-[10px] text-white/35 truncate">{org?.name ?? ""}</p>
          </div>
          <button
            onClick={signOut}
            title="Déconnexion"
            className="w-6 h-6 flex items-center justify-center rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
