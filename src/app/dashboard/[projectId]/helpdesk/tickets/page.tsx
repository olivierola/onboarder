"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Search, Plus, Loader2, X, ChevronDown, ExternalLink,
  AlertTriangle, Clock, CheckCircle2, XCircle, Filter, RefreshCw,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────────────
interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  source: string;
  user_email: string | null;
  user_name:  string | null;
  user_traits: Record<string, unknown>;
  tags: string[];
  created_at: string;
  updated_at: string;
  resolution: string | null;
  resolved_at: string | null;
  session_id: string | null;
}

interface StatusCounts {
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
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

const PRIORITY_CFG: Record<string, { label: string; cls: string; dot: string }> = {
  urgent: { label: "Urgent",  cls: "text-red-700 bg-red-50 border-red-200",     dot: "bg-red-500" },
  high:   { label: "Haute",   cls: "text-orange-700 bg-orange-50 border-orange-200", dot: "bg-orange-400" },
  medium: { label: "Moyenne", cls: "text-yellow-700 bg-yellow-50 border-yellow-200", dot: "bg-yellow-400" },
  low:    { label: "Basse",   cls: "text-slate-600 bg-slate-50 border-slate-200",    dot: "bg-slate-300" },
};

const STATUS_CFG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  open:        { label: "Ouvert",   cls: "text-red-600 bg-red-50 border-red-200",       icon: <AlertTriangle className="w-3 h-3" /> },
  in_progress: { label: "En cours", cls: "text-blue-600 bg-blue-50 border-blue-200",    icon: <Clock className="w-3 h-3" /> },
  resolved:    { label: "Résolu",   cls: "text-emerald-600 bg-emerald-50 border-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> },
  closed:      { label: "Fermé",    cls: "text-slate-500 bg-slate-100 border-slate-200", icon: <XCircle className="w-3 h-3" /> },
};

const STATUS_NEXT: Record<string, string> = {
  open: "in_progress", in_progress: "resolved", resolved: "closed",
};
const STATUS_NEXT_LABEL: Record<string, string> = {
  open: "→ En cours", in_progress: "→ Résolu", resolved: "→ Fermer",
};

// ── Component ────────────────────────────────────────────────────────────────
export default function TicketsPage() {
  const params    = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const HELPDESK_URL = `${SUPABASE_URL}/functions/v1/helpdesk`;
  const authHeaders  = { Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY };

  // Filters
  const [statusFilter,   setStatusFilter]   = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [sourceFilter,   setSourceFilter]   = useState<string>("");
  const [search,         setSearch]         = useState("");

  // Data
  const [tickets,   setTickets]   = useState<Ticket[]>([]);
  const [counts,    setCounts]    = useState<StatusCounts>({ open: 0, in_progress: 0, resolved: 0, closed: 0 });
  const [loading,   setLoading]   = useState(true);

  // Create ticket modal
  const [showCreate,  setShowCreate]  = useState(false);
  const [creating,    setCreating]    = useState(false);
  const [createForm,  setCreateForm]  = useState({ title: "", description: "", priority: "medium" });

  // Expanded ticket for resolution
  const [expanded, setExpanded] = useState<string | null>(null);
  const [resolutionInput, setResolutionInput] = useState<Record<string, string>>({});

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL(HELPDESK_URL);
      url.searchParams.set("projectId", projectId);
      url.searchParams.set("view", "tickets");
      if (statusFilter)   url.searchParams.set("status",   statusFilter);
      if (priorityFilter) url.searchParams.set("priority", priorityFilter);
      if (sourceFilter)   url.searchParams.set("source",   sourceFilter);
      if (search)         url.searchParams.set("q",        search);

      const res  = await fetch(url.toString(), { headers: authHeaders });
      const data = await res.json();
      setTickets(data.tickets ?? []);
      if (data.counts) setCounts(data.counts);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, statusFilter, priorityFilter, sourceFilter, search]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(fetchTickets, 350);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // ── Actions ──────────────────────────────────────────────────────────────
  async function advanceStatus(id: string, currentStatus: string) {
    const next = STATUS_NEXT[currentStatus];
    if (!next) return;
    const res = await fetch(`${HELPDESK_URL}?id=${id}`, {
      method:  "PATCH",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body:    JSON.stringify({ status: next }),
    });
    if (res.ok) {
      const { ticket } = await res.json();
      setTickets(prev => prev.map(t => t.id === id ? ticket : t));
      setCounts(prev => ({
        ...prev,
        [currentStatus]: Math.max(0, (prev[currentStatus as keyof StatusCounts] ?? 0) - 1),
        [next]: (prev[next as keyof StatusCounts] ?? 0) + 1,
      }));
    }
  }

  async function saveResolution(id: string) {
    const resolution = resolutionInput[id] ?? "";
    const res = await fetch(`${HELPDESK_URL}?id=${id}`, {
      method:  "PATCH",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body:    JSON.stringify({ status: "resolved", resolution }),
    });
    if (res.ok) {
      const { ticket } = await res.json();
      setTickets(prev => prev.map(t => t.id === id ? ticket : t));
      setExpanded(null);
    }
  }

  async function deleteTicket(id: string) {
    if (!confirm("Supprimer ce ticket ?")) return;
    const res = await fetch(`${HELPDESK_URL}?id=${id}`, {
      method:  "DELETE",
      headers: authHeaders,
    });
    if (res.ok) {
      const t = tickets.find(t => t.id === id);
      if (t) {
        setTickets(prev => prev.filter(tk => tk.id !== id));
        setCounts(prev => ({ ...prev, [t.status]: Math.max(0, (prev[t.status as keyof StatusCounts] ?? 0) - 1) }));
      }
    }
  }

  async function handleCreate() {
    if (!createForm.title) return;
    setCreating(true);
    try {
      const res = await fetch(HELPDESK_URL, {
        method:  "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body:    JSON.stringify({
          action:      "create_ticket",
          project_id:  projectId,
          title:       createForm.title,
          description: createForm.description,
          priority:    createForm.priority,
          source:      "user",
        }),
      });
      if (res.ok) {
        const { ticket } = await res.json();
        setTickets(prev => [ticket, ...prev]);
        setCounts(prev => ({ ...prev, open: prev.open + 1 }));
        setShowCreate(false);
        setCreateForm({ title: "", description: "", priority: "medium" });
      }
    } finally {
      setCreating(false);
    }
  }

  const totalActive = counts.open + counts.in_progress;

  return (
    <div className="p-6 space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Tickets</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {totalActive > 0 ? `${totalActive} ticket${totalActive > 1 ? "s" : ""} actif${totalActive > 1 ? "s" : ""}` : "Aucun ticket actif"}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Nouveau ticket
        </button>
      </div>

      {/* ── Status tabs ─────────────────────────────────────────────────── */}
      <div className="flex gap-2">
        {(["", "open", "in_progress", "resolved", "closed"] as const).map(s => {
          const cfg   = s ? STATUS_CFG[s] : null;
          const count = s ? counts[s as keyof StatusCounts] : counts.open + counts.in_progress + counts.resolved + counts.closed;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all",
                statusFilter === s
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              )}
            >
              {cfg?.icon}
              {cfg?.label ?? "Tous"}
              <span className={cn(
                "px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                statusFilter === s ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher dans les tickets…"
            className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 outline-none focus:border-indigo-300 transition-all"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Priority filter */}
        <div className="relative">
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="appearance-none px-3 pr-7 py-2 text-sm bg-white border border-slate-200 rounded-xl text-slate-600 outline-none focus:border-indigo-300 transition-all cursor-pointer"
          >
            <option value="">Toutes priorités</option>
            <option value="urgent">Urgent</option>
            <option value="high">Haute</option>
            <option value="medium">Moyenne</option>
            <option value="low">Basse</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>

        {/* Source filter */}
        <div className="relative">
          <select
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
            className="appearance-none px-3 pr-7 py-2 text-sm bg-white border border-slate-200 rounded-xl text-slate-600 outline-none focus:border-indigo-300 transition-all cursor-pointer"
          >
            <option value="">Toutes sources</option>
            <option value="user">👤 Utilisateur</option>
            <option value="ai">🤖 IA</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>

        <button
          onClick={fetchTickets}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {(priorityFilter || sourceFilter) && (
          <button
            onClick={() => { setPriorityFilter(""); setSourceFilter(""); }}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
          >
            <X className="w-3.5 h-3.5" />
            Réinitialiser
          </button>
        )}
      </div>

      {/* ── Create ticket modal ──────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-slate-900">Nouveau ticket</h2>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Titre *</label>
                <input
                  type="text"
                  value={createForm.title}
                  onChange={e => setCreateForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Résumé du problème"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-indigo-300 text-slate-700 placeholder-slate-400 transition-colors"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Description</label>
                <textarea
                  value={createForm.description}
                  onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Décrivez le problème en détail…"
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-indigo-300 text-slate-700 placeholder-slate-400 resize-none transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Priorité</label>
                <select
                  value={createForm.priority}
                  onChange={e => setCreateForm(p => ({ ...p, priority: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-indigo-300 text-slate-700 transition-colors"
                >
                  <option value="low">Basse</option>
                  <option value="medium">Moyenne</option>
                  <option value="high">Haute</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 text-sm font-medium border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={!createForm.title || creating}
                className="flex-1 py-2.5 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Créer le ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tickets table ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-8">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-3">
              <Filter className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700 mb-1">Aucun ticket trouvé</h3>
            <p className="text-xs text-slate-400">Modifiez les filtres ou créez un nouveau ticket.</p>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-3 border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <span>Ticket</span>
              <span>Priorité</span>
              <span>Statut</span>
              <span>Source</span>
              <span>Date</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-50">
              {tickets.map(t => {
                const statusCfg   = STATUS_CFG[t.status] ?? STATUS_CFG.open;
                const priorityCfg = PRIORITY_CFG[t.priority] ?? PRIORITY_CFG.medium;
                const isExpanded  = expanded === t.id;

                return (
                  <div key={t.id}>
                    <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-5 py-4 hover:bg-slate-50 transition-colors">

                      {/* Title + user */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-800 truncate">{t.title}</span>
                          {t.session_id && (
                            <a
                              href={`../helpdesk/inbox`}
                              className="text-slate-300 hover:text-indigo-500 transition-colors shrink-0"
                              title="Voir dans l'inbox"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        {t.description && (
                          <p className="text-xs text-slate-400 truncate mt-0.5">{t.description}</p>
                        )}
                        {(t.user_name || t.user_email) && (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {t.user_name ?? t.user_email}
                          </p>
                        )}
                      </div>

                      {/* Priority */}
                      <span className={cn(
                        "flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full border whitespace-nowrap",
                        priorityCfg.cls
                      )}>
                        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", priorityCfg.dot)} />
                        {priorityCfg.label}
                      </span>

                      {/* Status */}
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full border whitespace-nowrap",
                          statusCfg.cls
                        )}>
                          {statusCfg.icon}
                          {statusCfg.label}
                        </span>
                        {STATUS_NEXT[t.status] && (
                          <button
                            onClick={() => t.status === "in_progress"
                              ? setExpanded(isExpanded ? null : t.id)
                              : advanceStatus(t.id, t.status)
                            }
                            className="text-[10px] font-medium text-slate-400 hover:text-indigo-600 transition-colors whitespace-nowrap"
                          >
                            {STATUS_NEXT_LABEL[t.status]}
                          </button>
                        )}
                      </div>

                      {/* Source */}
                      <span className="text-xs text-slate-500 whitespace-nowrap">
                        {t.source === "ai" ? "🤖 IA" : "👤 User"}
                      </span>

                      {/* Date + delete */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 whitespace-nowrap">{timeAgo(t.created_at)}</span>
                        <button
                          onClick={() => deleteTicket(t.id)}
                          className="text-slate-300 hover:text-red-400 transition-colors"
                          title="Supprimer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded: resolution input */}
                    {isExpanded && (
                      <div className="px-5 pb-4 bg-slate-50 border-t border-slate-100">
                        <p className="text-xs font-medium text-slate-600 mb-2 mt-3">Résolution (optionnel)</p>
                        <textarea
                          value={resolutionInput[t.id] ?? ""}
                          onChange={e => setResolutionInput(p => ({ ...p, [t.id]: e.target.value }))}
                          placeholder="Décrivez comment ce ticket a été résolu…"
                          rows={2}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-indigo-300 bg-white text-slate-700 placeholder-slate-400 resize-none transition-colors"
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => saveResolution(t.id)}
                            className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all"
                          >
                            Marquer comme résolu
                          </button>
                          <button
                            onClick={() => setExpanded(null)}
                            className="px-4 py-1.5 text-xs font-medium border border-slate-200 text-slate-600 rounded-lg hover:bg-white transition-all"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
