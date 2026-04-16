"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Search, MessageCircle, User, Bot, Ticket as TicketIcon,
  AlertCircle, Plus, Loader2, RefreshCw, X,
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
  last_message_role: string | null;
  ticket_count: number;
  open_ticket_count: number;
  avg_confidence: number | null;
  started_at: string;
  last_seen_at: string | null;
  current_route: string | null;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  confidence: number | null;
  ts: string;
  actions: Record<string, unknown> | null;
}

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  source: string;
  user_email: string | null;
  user_name: string | null;
  tags: string[];
  created_at: string;
  resolution: string | null;
}

interface Insights {
  message_count: number;
  user_messages: number;
  assistant_messages: number;
  avg_confidence: number | null;
  low_conf_count: number;
  intents: Record<string, number>;
  duration_ms: number | null;
  routes_visited: number;
  steps_completed: number;
  activated: boolean;
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
  return `${Math.floor(h / 24)}j`;
}

function formatDuration(ms: number | null): string {
  if (!ms || ms < 0) return "—";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "text-red-600 bg-red-50 border-red-200",
  high:   "text-orange-600 bg-orange-50 border-orange-200",
  medium: "text-yellow-600 bg-yellow-50 border-yellow-200",
  low:    "text-slate-500 bg-slate-50 border-slate-200",
};

const STATUS_COLORS: Record<string, string> = {
  open:        "text-red-600 bg-red-50 border-red-200",
  in_progress: "text-blue-600 bg-blue-50 border-blue-200",
  resolved:    "text-emerald-600 bg-emerald-50 border-emerald-200",
  closed:      "text-slate-500 bg-slate-100 border-slate-200",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Ouvert", in_progress: "En cours", resolved: "Résolu", closed: "Fermé",
};

const INTENT_LABELS: Record<string, string> = {
  explain:            "Explication",
  navigate_to_feature:"Navigation",
  troubleshoot:       "Dépannage",
  discover:           "Découverte",
  guide_flow:         "Guide",
  open_ticket:        "Ticket",
  confirm:            "Confirmation",
  smalltalk:          "Chat",
};

// ── Component ────────────────────────────────────────────────────────────────
export default function InboxPage() {
  const params    = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const ANON_KEY      = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const HELPDESK_URL  = `${SUPABASE_URL}/functions/v1/helpdesk`;
  const authHeaders   = { Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY };

  // ── State ──────────────────────────────────────────────────────────────
  const [sessions,         setSessions]         = useState<Session[]>([]);
  const [loadingSessions,  setLoadingSessions]  = useState(true);
  const [search,           setSearch]           = useState("");

  const [selectedId,       setSelectedId]       = useState<string | null>(null);
  const [selectedSession,  setSelectedSession]  = useState<Session | null>(null);
  const [messages,         setMessages]         = useState<ChatMessage[]>([]);
  const [insights,         setInsights]         = useState<Insights | null>(null);
  const [tickets,          setTickets]          = useState<Ticket[]>([]);
  const [loadingDetail,    setLoadingDetail]    = useState(false);

  const [creatingTicket,   setCreatingTicket]   = useState(false);
  const [ticketForm,       setTicketForm]       = useState({ title: "", description: "", priority: "medium" });
  const [savingTicket,     setSavingTicket]     = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── API helpers ────────────────────────────────────────────────────────
  const fetchSessions = useCallback(async (q = "") => {
    setLoadingSessions(true);
    try {
      const url = new URL(HELPDESK_URL);
      url.searchParams.set("projectId", projectId);
      url.searchParams.set("view", "inbox");
      if (q) url.searchParams.set("q", q);
      const res  = await fetch(url.toString(), { headers: authHeaders });
      const data = await res.json();
      setSessions(data.sessions ?? []);
    } catch { /* ignore */ } finally {
      setLoadingSessions(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => fetchSessions(search), 350);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const selectSession = useCallback(async (session: Session) => {
    setSelectedId(session.id);
    setSelectedSession(session);
    setLoadingDetail(true);
    setMessages([]);
    setInsights(null);
    setTickets([]);
    setCreatingTicket(false);
    try {
      const url = new URL(HELPDESK_URL);
      url.searchParams.set("projectId", projectId);
      url.searchParams.set("view", "session");
      url.searchParams.set("id", session.id);
      const res  = await fetch(url.toString(), { headers: authHeaders });
      const data = await res.json();
      setMessages(data.messages ?? []);
      setInsights(data.insights ?? null);
      setTickets(data.tickets ?? []);
    } catch { /* ignore */ } finally {
      setLoadingDetail(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function updateTicketStatus(ticketId: string, status: string) {
    const res = await fetch(`${HELPDESK_URL}?id=${ticketId}`, {
      method:  "PATCH",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body:    JSON.stringify({ status }),
    });
    if (res.ok) {
      const { ticket } = await res.json();
      setTickets(prev => prev.map(t => t.id === ticketId ? ticket : t));
      setSessions(prev => prev.map(s => {
        if (s.id !== selectedId) return s;
        const wasOpen = ["open", "in_progress"].includes(status) ? 1 : 0;
        return { ...s, open_ticket_count: Math.max(0, s.open_ticket_count + wasOpen) };
      }));
    }
  }

  async function handleCreateTicket() {
    if (!ticketForm.title || !selectedId) return;
    setSavingTicket(true);
    try {
      const res = await fetch(HELPDESK_URL, {
        method:  "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body:    JSON.stringify({
          action:      "create_ticket",
          project_id:  projectId,
          session_id:  selectedId,
          title:       ticketForm.title,
          description: ticketForm.description,
          priority:    ticketForm.priority,
          source:      "user",
          user_email:  String(selectedSession?.user_traits?.email ?? ""),
          user_name:   String(selectedSession?.user_traits?.name  ?? ""),
          user_traits: selectedSession?.user_traits ?? {},
        }),
      });
      if (res.ok) {
        const { ticket } = await res.json();
        setTickets(prev => [ticket, ...prev]);
        setSessions(prev => prev.map(s => s.id === selectedId
          ? { ...s, ticket_count: s.ticket_count + 1, open_ticket_count: s.open_ticket_count + 1 }
          : s
        ));
        setCreatingTicket(false);
        setTicketForm({ title: "", description: "", priority: "medium" });
      }
    } finally {
      setSavingTicket(false);
    }
  }

  // ── Display helpers ────────────────────────────────────────────────────
  function userName(s: Session): string {
    const t = s.user_traits ?? {};
    return String(t.name ?? t.email ?? "Anonyme");
  }
  function userInitials(s: Session): string {
    return userName(s).slice(0, 2).toUpperCase();
  }
  function confColor(c: number | null): string {
    if (c === null) return "text-slate-400";
    if (c >= 0.7)  return "text-emerald-600";
    if (c >= 0.5)  return "text-yellow-600";
    return "text-red-500";
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-hidden flex">

      {/* ── LEFT: Sessions list ────────────────────────────────────────── */}
      <div className="w-72 flex flex-col border-r border-slate-200 bg-white h-full shrink-0">

        {/* Header */}
        <div className="px-4 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-800">Inbox</h2>
            <button
              onClick={() => fetchSessions(search)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher une session…"
              className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 outline-none focus:border-indigo-300 focus:bg-white transition-all"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loadingSessions ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <MessageCircle className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">Aucune session</p>
              <p className="text-xs text-slate-300 mt-1">Les conversations de l'agent apparaîtront ici.</p>
            </div>
          ) : (
            sessions.map(s => (
              <button
                key={s.id}
                onClick={() => selectSession(s)}
                className={cn(
                  "w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors",
                  selectedId === s.id
                    ? "bg-indigo-50 border-l-[3px] border-l-indigo-500 pl-[13px]"
                    : "border-l-[3px] border-l-transparent"
                )}
              >
                <div className="flex items-start gap-2.5">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ring-1",
                    s.activated
                      ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
                      : "bg-slate-100 text-slate-600 ring-slate-200"
                  )}>
                    {userInitials(s)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-slate-700 truncate">{userName(s)}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">{timeAgo(s.last_message_at)}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5 leading-snug">
                      {s.last_message_role === "assistant" && (
                        <span className="text-indigo-400 mr-1">Agent:</span>
                      )}
                      {s.last_message ?? "Pas encore de message"}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-[10px] text-slate-400">{s.conversation_turns} msg</span>
                      {s.open_ticket_count > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-200">
                          <TicketIcon className="w-2.5 h-2.5" />
                          {s.open_ticket_count}
                        </span>
                      )}
                      {s.activated && (
                        <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
                          Activé
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── MIDDLE: Chat thread ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {!selectedId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 bg-slate-50">
            <div className="w-16 h-16 bg-white border border-slate-200 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
              <MessageCircle className="w-7 h-7 text-slate-300" />
            </div>
            <h3 className="text-sm font-semibold text-slate-600 mb-1">Sélectionnez une session</h3>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
              Cliquez sur une conversation dans la liste pour voir les échanges avec l&apos;agent.
            </p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-5 py-3.5 border-b border-slate-200 bg-white shrink-0 flex items-center gap-3">
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ring-1 shrink-0",
                selectedSession?.activated
                  ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
                  : "bg-slate-100 text-slate-600 ring-slate-200"
              )}>
                {selectedSession ? userInitials(selectedSession) : "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800">
                  {selectedSession ? userName(selectedSession) : "…"}
                </div>
                <div className="text-xs text-slate-400 truncate">
                  {String(selectedSession?.user_traits?.email ?? "")}
                  {selectedSession?.current_route && (
                    <span className="ml-2 font-mono text-slate-300">{selectedSession.current_route}</span>
                  )}
                </div>
              </div>
              {selectedSession && (
                <div className="text-[10px] text-slate-400 text-right shrink-0">
                  <div>{selectedSession.conversation_turns} échanges</div>
                  <div>Démarré {timeAgo(selectedSession.started_at)}</div>
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-slate-50">
              {loadingDetail ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <MessageCircle className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-sm text-slate-400">Aucun message dans cette session</p>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={msg.id ?? i} className={cn("flex gap-2.5", msg.role === "user" ? "flex-row-reverse" : "")}>
                    {/* Avatar */}
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center shrink-0 ring-1 mt-0.5",
                      msg.role === "user"
                        ? "bg-indigo-100 text-indigo-600 ring-indigo-200"
                        : "bg-slate-800 text-white ring-slate-700"
                    )}>
                      {msg.role === "user"
                        ? <User className="w-3.5 h-3.5" />
                        : <Bot className="w-3.5 h-3.5" />
                      }
                    </div>

                    {/* Bubble */}
                    <div className={cn("max-w-[72%] space-y-1", msg.role === "user" && "flex flex-col items-end")}>
                      <div className={cn(
                        "px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed",
                        msg.role === "user"
                          ? "bg-indigo-500 text-white rounded-tr-sm"
                          : "bg-white border border-slate-200 text-slate-700 rounded-tl-sm shadow-sm"
                      )}>
                        {msg.content}
                      </div>
                      <div className="flex items-center gap-2 px-1">
                        <span className="text-[10px] text-slate-400">
                          {new Date(msg.ts).toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {msg.role === "assistant" && msg.confidence !== null && (
                          <span className={cn("text-[10px] font-mono", confColor(msg.confidence))}>
                            {Math.round((msg.confidence ?? 0) * 100)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </>
        )}
      </div>

      {/* ── RIGHT: Insights & Tickets ───────────────────────────────────── */}
      <div className="w-80 border-l border-slate-200 bg-white flex flex-col h-full overflow-hidden shrink-0">
        {!selectedId ? (
          <div className="flex-1 flex items-center justify-center p-6 text-center">
            <p className="text-xs text-slate-400 leading-relaxed">
              Les insights, l&apos;analyse et les tickets de la session s&apos;afficheront ici.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">

            {/* User info */}
            {selectedSession && (
              <div className="p-4 border-b border-slate-100">
                <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Profil utilisateur</h3>
                {Object.keys(selectedSession.user_traits ?? {}).length === 0 ? (
                  <p className="text-xs text-slate-400">Aucun trait de profil.</p>
                ) : (
                  <div className="space-y-1.5">
                    {Object.entries(selectedSession.user_traits ?? {}).slice(0, 8).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-500 capitalize shrink-0">{k}</span>
                        <span className="text-[11px] font-medium text-slate-700 truncate text-right max-w-[160px]">
                          {String(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Insights */}
            {!loadingDetail && insights && (
              <div className="p-4 border-b border-slate-100">
                <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Analyse</h3>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {[
                    { label: "Messages",      value: insights.message_count },
                    { label: "Confiance moy", value: insights.avg_confidence !== null ? `${Math.round(insights.avg_confidence * 100)}%` : "—", color: confColor(insights.avg_confidence) },
                    { label: "Durée",         value: formatDuration(insights.duration_ms) },
                    { label: "Pages vues",    value: insights.routes_visited },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-50 rounded-lg p-2.5">
                      <div className={cn("text-base font-bold text-slate-800", s.color)}>{s.value}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Low confidence warning */}
                {insights.low_conf_count > 0 && (
                  <div className="flex items-center gap-2 px-2.5 py-2 bg-yellow-50 border border-yellow-200 rounded-lg mb-3">
                    <AlertCircle className="w-3.5 h-3.5 text-yellow-600 shrink-0" />
                    <span className="text-[11px] text-yellow-700">
                      {insights.low_conf_count} réponse{insights.low_conf_count > 1 ? "s" : ""} à faible confiance
                    </span>
                  </div>
                )}

                {/* Intents */}
                {Object.keys(insights.intents).length > 0 && (
                  <div>
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-1.5">Intents détectés</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(insights.intents).map(([intent, count]) => (
                        <span key={intent} className="inline-flex items-center gap-1 text-[10px] font-medium bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full border border-indigo-200">
                          {INTENT_LABELS[intent] ?? intent}
                          {count > 1 && <span className="text-indigo-400">×{count}</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tickets */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Tickets {tickets.length > 0 && `(${tickets.length})`}
                </h3>
                <button
                  onClick={() => setCreatingTicket(v => !v)}
                  className={cn(
                    "flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg transition-all",
                    creatingTicket
                      ? "bg-slate-100 text-slate-600"
                      : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                  )}
                >
                  {creatingTicket ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                  {creatingTicket ? "Annuler" : "Nouveau"}
                </button>
              </div>

              {/* Create ticket form */}
              {creatingTicket && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3 space-y-2">
                  <input
                    type="text"
                    value={ticketForm.title}
                    onChange={e => setTicketForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="Titre du ticket *"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-300 text-slate-700 placeholder-slate-400 transition-colors"
                  />
                  <textarea
                    value={ticketForm.description}
                    onChange={e => setTicketForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Description du problème…"
                    rows={2}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-300 text-slate-700 placeholder-slate-400 resize-none transition-colors"
                  />
                  <select
                    value={ticketForm.priority}
                    onChange={e => setTicketForm(p => ({ ...p, priority: e.target.value }))}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-300 text-slate-700"
                  >
                    <option value="low">Priorité basse</option>
                    <option value="medium">Priorité moyenne</option>
                    <option value="high">Priorité haute</option>
                    <option value="urgent">Urgent</option>
                  </select>
                  <button
                    onClick={handleCreateTicket}
                    disabled={!ticketForm.title || savingTicket}
                    className="w-full py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5"
                  >
                    {savingTicket && <Loader2 className="w-3 h-3 animate-spin" />}
                    Créer le ticket
                  </button>
                </div>
              )}

              {/* Tickets list */}
              {loadingDetail ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                </div>
              ) : tickets.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Aucun ticket pour cette session.</p>
              ) : (
                <div className="space-y-2">
                  {tickets.map(t => (
                    <div key={t.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <div className="flex items-start gap-2 mb-1.5">
                        <span className="text-xs font-medium text-slate-800 leading-tight flex-1">{t.title}</span>
                        <span className={cn(
                          "text-[10px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0",
                          PRIORITY_COLORS[t.priority] ?? "text-slate-500 bg-slate-50 border-slate-200"
                        )}>
                          {t.priority}
                        </span>
                      </div>
                      {t.description && (
                        <p className="text-[11px] text-slate-500 mb-2 leading-relaxed line-clamp-2">{t.description}</p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          "text-[10px] font-medium px-1.5 py-0.5 rounded-full border",
                          STATUS_COLORS[t.status] ?? ""
                        )}>
                          {STATUS_LABELS[t.status] ?? t.status}
                        </span>
                        {t.status === "open" && (
                          <button
                            onClick={() => updateTicketStatus(t.id, "in_progress")}
                            className="text-[10px] text-blue-600 hover:text-blue-700 font-medium ml-auto"
                          >
                            → En cours
                          </button>
                        )}
                        {t.status === "in_progress" && (
                          <button
                            onClick={() => updateTicketStatus(t.id, "resolved")}
                            className="text-[10px] text-emerald-600 hover:text-emerald-700 font-medium ml-auto"
                          >
                            ✓ Résolu
                          </button>
                        )}
                        <span className="text-[10px] text-slate-400 ml-auto">
                          {t.source === "ai" ? "🤖 IA" : "👤 User"}
                        </span>
                      </div>
                      {t.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {t.tags.map(tag => (
                            <span key={tag} className="text-[9px] bg-white border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
