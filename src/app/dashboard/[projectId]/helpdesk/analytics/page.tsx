export const dynamic = "force-dynamic";

import { Ticket, Users, CheckCircle2, AlertTriangle, Clock, Zap, Bot, User, TrendingUp } from "lucide-react";

interface StatsData {
  tickets: {
    total: number;
    open: number;
    in_progress: number;
    resolved: number;
    by_source: { user: number; ai: number };
    by_priority: { urgent: number; high: number; medium: number; low: number };
  };
  sessions: {
    total: number;
    activated: number;
    with_chat: number;
  };
}

async function fetchStats(projectId: string): Promise<StatsData | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;
  try {
    const res = await fetch(
      `${supabaseUrl}/functions/v1/helpdesk?projectId=${projectId}&view=stats`,
      {
        headers: {
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        },
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function HelpdeskAnalyticsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const stats = await fetchStats(projectId);

  const t  = stats?.tickets  ?? { total: 0, open: 0, in_progress: 0, resolved: 0, by_source: { user: 0, ai: 0 }, by_priority: { urgent: 0, high: 0, medium: 0, low: 0 } };
  const s  = stats?.sessions ?? { total: 0, activated: 0, with_chat: 0 };

  const activationRate = s.total > 0 ? Math.round((s.activated / s.total) * 100) : 0;
  const chatRate       = s.total > 0 ? Math.round((s.with_chat  / s.total) * 100) : 0;
  const resolutionRate = (t.total > 0) ? Math.round((t.resolved / t.total) * 100) : 0;

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Analytics Helpdesk</h1>
        <p className="text-sm text-slate-500 mt-0.5">Vue d&apos;ensemble des tickets et sessions d&apos;onboarding.</p>
      </div>

      {/* ── Top KPIs ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: "Total tickets",
            value: t.total,
            icon: Ticket,
            color: "bg-indigo-100 text-indigo-600",
          },
          {
            label: "Tickets actifs",
            value: t.open + t.in_progress,
            icon: AlertTriangle,
            color: "bg-red-100 text-red-600",
          },
          {
            label: "Taux de résolution",
            value: `${resolutionRate}%`,
            icon: CheckCircle2,
            color: "bg-emerald-100 text-emerald-600",
          },
          {
            label: "Sessions totales",
            value: s.total,
            icon: Users,
            color: "bg-violet-100 text-violet-600",
          },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${kpi.color}`}>
              <kpi.icon className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{kpi.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* ── Row 2 ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">

        {/* Tickets by status */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Tickets par statut</h2>
          <div className="space-y-3">
            {[
              { label: "Ouverts",   value: t.open,        total: t.total, cls: "bg-red-500" },
              { label: "En cours",  value: t.in_progress, total: t.total, cls: "bg-blue-500" },
              { label: "Résolus",   value: t.resolved,    total: t.total, cls: "bg-emerald-500" },
              { label: "Fermés",    value: t.total - t.open - t.in_progress - t.resolved, total: t.total, cls: "bg-slate-300" },
            ].map(row => (
              <div key={row.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-600">{row.label}</span>
                  <span className="text-xs font-semibold text-slate-800">{row.value}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div
                    className={`${row.cls} h-1.5 rounded-full transition-all`}
                    style={{ width: row.total > 0 ? `${Math.round((row.value / row.total) * 100)}%` : "0%" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tickets by priority */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Tickets par priorité</h2>
          <div className="space-y-3">
            {[
              { label: "Urgent", value: t.by_priority.urgent, cls: "bg-red-500",    badge: "text-red-700 bg-red-50 border-red-200" },
              { label: "Haute",  value: t.by_priority.high,   cls: "bg-orange-400", badge: "text-orange-700 bg-orange-50 border-orange-200" },
              { label: "Moyenne",value: t.by_priority.medium, cls: "bg-yellow-400", badge: "text-yellow-700 bg-yellow-50 border-yellow-200" },
              { label: "Basse",  value: t.by_priority.low,    cls: "bg-slate-300",  badge: "text-slate-600 bg-slate-50 border-slate-200" },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${row.cls}`} />
                  <span className="text-xs text-slate-600">{row.label}</span>
                </div>
                <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                  <div
                    className={`${row.cls} h-1.5 rounded-full transition-all`}
                    style={{ width: t.total > 0 ? `${Math.round((row.value / t.total) * 100)}%` : "0%" }}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-700 w-5 text-right">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Source breakdown */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Source des tickets</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
                <User className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <div className="text-xl font-bold text-slate-900">{t.by_source.user}</div>
                <div className="text-xs text-slate-500">Ouverts par l&apos;utilisateur</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-violet-50 rounded-xl flex items-center justify-center">
                <Bot className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <div className="text-xl font-bold text-slate-900">{t.by_source.ai}</div>
                <div className="text-xs text-slate-500">Ouverts automatiquement par l&apos;IA</div>
              </div>
            </div>
            {t.total > 0 && (
              <div className="mt-2">
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>User {Math.round((t.by_source.user / t.total) * 100)}%</span>
                  <span>IA {Math.round((t.by_source.ai / t.total) * 100)}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 flex overflow-hidden">
                  <div
                    className="bg-indigo-400 h-2 transition-all"
                    style={{ width: `${Math.round((t.by_source.user / t.total) * 100)}%` }}
                  />
                  <div
                    className="bg-violet-400 h-2 transition-all"
                    style={{ width: `${Math.round((t.by_source.ai / t.total) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Sessions metrics ───────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">Métriques des sessions</h2>
        <div className="grid grid-cols-3 gap-6">

          {/* Activation rate */}
          <div className="text-center">
            <div className="relative w-20 h-20 mx-auto mb-3">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  stroke="#10b981" strokeWidth="3"
                  strokeDasharray={`${activationRate} 100`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-slate-900">{activationRate}%</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-1 text-sm font-semibold text-slate-700">
              <Zap className="w-3.5 h-3.5 text-emerald-500" />
              Taux d&apos;activation
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{s.activated}/{s.total} sessions</p>
          </div>

          {/* Chat engagement */}
          <div className="text-center">
            <div className="relative w-20 h-20 mx-auto mb-3">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  stroke="#6366f1" strokeWidth="3"
                  strokeDasharray={`${chatRate} 100`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-slate-900">{chatRate}%</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-1 text-sm font-semibold text-slate-700">
              <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
              Engagement chat
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{s.with_chat}/{s.total} sessions avec chat</p>
          </div>

          {/* Ticket rate */}
          <div className="text-center">
            <div className="relative w-20 h-20 mx-auto mb-3">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  stroke={resolutionRate >= 70 ? "#10b981" : resolutionRate >= 40 ? "#f59e0b" : "#ef4444"} strokeWidth="3"
                  strokeDasharray={`${resolutionRate} 100`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-slate-900">{resolutionRate}%</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-1 text-sm font-semibold text-slate-700">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Taux de résolution
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{t.resolved}/{t.total} tickets résolus</p>
          </div>
        </div>
      </div>

      {/* ── Empty state ────────────────────────────────────────────────── */}
      {!stats && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
          <Clock className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-amber-800">Données non disponibles</p>
          <p className="text-xs text-amber-600 mt-1">
            Vérifiez que la fonction helpdesk est déployée et que le projet est correctement configuré.
          </p>
        </div>
      )}
    </div>
  );
}
