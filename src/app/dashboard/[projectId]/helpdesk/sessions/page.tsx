"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Search, Loader2, RefreshCw, X, ChevronRight,
  Zap, MessageCircle, MapPin, CheckSquare, Ticket as TicketIcon,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────────────
interface Session {
  id: string;
  user_traits: Record<string, unknown>;
  status: string;
  activated: boolean;
  conversation_turns: number;
  last_message: string | null;
  last_message_at: string | null;
  ticket_count: number;
  open_ticket_count: number;
  avg_confidence: number | null;
  started_at: string;
  last_seen_at: string | null;
  current_route: string | null;
  visited_routes: string[] | null;
  completed_steps: string[] | null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}j`;
  return new Date(dateStr).toLocaleDateString("fr", { day: "numeric", month: "short" });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("fr", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

// ── Component ────────────────────────────────────────────────────────────────
export default function SessionsPage() {
  const params    = useParams<{ projectId: string }>();
  const router    = useRouter();
  const projectId = params.projectId;

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const HELPDESK_URL = `${SUPABASE_URL}/functions/v1/helpdesk`;
  const authHeaders  = { Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY };

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [page,     setPage]     = useState(1);

  const fetchSessions = useCallback(async (q = "", p = 1) => {
    setLoading(true);
    try {
      const url = new URL(HELPDESK_URL);
      url.searchParams.set("projectId", projectId);
      url.searchParams.set("view", "inbox");
      url.searchParams.set("page", String(p));
      if (q) url.searchParams.set("q", q);
      const res  = await fetch(url.toString(), { headers: authHeaders });
      const data = await res.json();
      setSessions(data.sessions ?? []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => { fetchSessions("", page); }, [fetchSessions, page]);

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); fetchSessions(search, 1); }, 350);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function confColor(c: number | null) {
    if (c === null) return "text-slate-400";
    if (c >= 0.7) return "text-emerald-600";
    if (c >= 0.5) return "text-yellow-500";
    return "text-red-500";
  }

  function userName(s: Session): string {
    const t = s.user_traits ?? {};
    return String(t.name ?? t.email ?? "Anonyme");
  }

  function userInitials(s: Session): string {
    return userName(s).slice(0, 2).toUpperCase();
  }


  return (
    <div className="p-6 space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Sessions d&apos;onboarding</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Toutes les sessions utilisateur créées par l&apos;agent.
          </p>
        </div>
        <button
          onClick={() => fetchSessions(search, page)}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ── Search ──────────────────────────────────────────────────────── */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom ou email…"
          className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 outline-none focus:border-indigo-300 transition-all"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <MessageCircle className="w-10 h-10 text-slate-300 mb-3" />
            <h3 className="text-sm font-semibold text-slate-600 mb-1">Aucune session trouvée</h3>
            <p className="text-xs text-slate-400">Les sessions apparaîtront une fois que des utilisateurs auront interagi avec l&apos;agent.</p>
          </div>
        ) : (
          <>
            {/* Header row */}
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-4 items-center px-5 py-3 border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <span className="w-8" />
              <span>Utilisateur</span>
              <span>Messages</span>
              <span>Confiance</span>
              <span>Tickets</span>
              <span>Démarré</span>
              <span />
            </div>

            {/* Data rows */}
            <div className="divide-y divide-slate-50">
              {sessions.map(s => (
                <div
                  key={s.id}
                  className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-4 items-center px-5 py-3.5 hover:bg-slate-50 transition-colors group"
                >
                  {/* Avatar */}
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ring-1 shrink-0",
                    s.activated
                      ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
                      : "bg-slate-100 text-slate-600 ring-slate-200"
                  )}>
                    {userInitials(s)}
                  </div>

                  {/* User info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800 truncate">{userName(s)}</span>
                      {s.activated && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200 shrink-0">
                          <Zap className="w-2.5 h-2.5" />
                          Activé
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[11px] text-slate-400">
                      {s.current_route && (
                        <span className="flex items-center gap-0.5 font-mono truncate max-w-[160px]">
                          <MapPin className="w-2.5 h-2.5 shrink-0" />
                          {s.current_route}
                        </span>
                      )}
                      {(s.completed_steps?.length ?? 0) > 0 && (
                        <span className="flex items-center gap-0.5">
                          <CheckSquare className="w-2.5 h-2.5 shrink-0" />
                          {s.completed_steps!.length} étape{s.completed_steps!.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="text-center">
                    <div className="flex items-center gap-1 justify-center text-slate-700">
                      <MessageCircle className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-sm font-semibold">{s.conversation_turns}</span>
                    </div>
                  </div>

                  {/* Confidence */}
                  <div className={cn("text-sm font-semibold text-center", confColor(s.avg_confidence))}>
                    {s.avg_confidence !== null ? `${Math.round(s.avg_confidence * 100)}%` : "—"}
                  </div>

                  {/* Tickets */}
                  <div className="text-center">
                    {s.ticket_count > 0 ? (
                      <span className={cn(
                        "inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full border",
                        s.open_ticket_count > 0
                          ? "text-red-600 bg-red-50 border-red-200"
                          : "text-slate-500 bg-slate-50 border-slate-200"
                      )}>
                        <TicketIcon className="w-2.5 h-2.5" />
                        {s.ticket_count}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </div>

                  {/* Date */}
                  <div className="text-xs text-slate-400 whitespace-nowrap">
                    <div>{timeAgo(s.started_at)}</div>
                    <div className="text-[10px] text-slate-300">{formatDate(s.started_at)}</div>
                  </div>

                  {/* Action */}
                  <button
                    onClick={() => router.push(`/dashboard/${projectId}/helpdesk/inbox`)}
                    className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[11px] font-medium text-indigo-600 bg-indigo-50 px-2.5 py-1.5 rounded-lg hover:bg-indigo-100 transition-all whitespace-nowrap"
                  >
                    Voir
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {!loading && sessions.length === 30 && (
        <div className="flex justify-center gap-2">
          {page > 1 && (
            <button
              onClick={() => setPage(p => p - 1)}
              className="px-4 py-2 text-sm font-medium border border-slate-200 bg-white text-slate-600 rounded-xl hover:bg-slate-50 transition-all"
            >
              ← Précédent
            </button>
          )}
          <button
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 text-sm font-medium border border-slate-200 bg-white text-slate-600 rounded-xl hover:bg-slate-50 transition-all"
          >
            Suivant →
          </button>
        </div>
      )}
    </div>
  );
}
