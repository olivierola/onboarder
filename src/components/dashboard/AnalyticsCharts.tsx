"use client"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from "recharts"
import { CommitsGrid } from "@/components/ui/commits-grid"

interface DailyPoint {
  date: string
  sessions: number
  chats: number
  activations: number
}
interface ConfPoint {
  date: string
  confidence: number
}
interface RouteItem {
  route: string
  count: number
  pct: number
}
interface Summary {
  totalSessions: number
  totalChats: number
  totalActivations: number
  activationRate: string
}

interface Props {
  dailyData: DailyPoint[]
  confData: ConfPoint[]
  topRoutes: RouteItem[]
  summary: Summary
  knowledgeGaps: number
  avgConfidence: number | null
}

export function AnalyticsCharts({ dailyData, confData, topRoutes, summary, knowledgeGaps, avgConfidence }: Props) {
  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Sessions totales", value: String(summary.totalSessions) },
          { label: "Interactions chat", value: String(summary.totalChats) },
          { label: "Activations", value: String(summary.totalActivations) },
          { label: "Taux d'activation", value: `${summary.activationRate}%` },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <div className="text-2xl font-bold text-slate-900">{s.value}</div>
            <div className="text-sm text-slate-600 mt-0.5">{s.label}</div>
            <div className="text-xs text-slate-400 mt-1">7 derniers jours</div>
          </div>
        ))}
      </div>

      {/* Chat interactions pixel art */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-1">Interactions chat (7j)</h2>
        <p className="text-xs text-slate-400 mb-4">Visualisation du volume de messages reçus</p>
        <div className="flex items-center gap-6">
          <CommitsGrid text={String(summary.totalChats)} />
          <div className="space-y-1">
            <div className="text-3xl font-bold text-slate-900">{summary.totalChats}</div>
            <div className="text-xs text-slate-500">messages chat</div>
            <div className="text-xs text-slate-400 mt-2">sur {summary.totalSessions} sessions</div>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Sessions & Interactions</h2>
          {dailyData.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">Pas encore de données</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dailyData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12, boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}
                  cursor={{ fill: "#f8fafc" }}
                />
                <Bar dataKey="sessions" fill="#c7d2fe" radius={[4, 4, 0, 0]} name="Sessions" />
                <Bar dataKey="chats" fill="#6366f1" radius={[4, 4, 0, 0]} name="Chats" />
                <Bar dataKey="activations" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Activations" />
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="flex gap-4 mt-3 justify-center">
            {[{ label: "Sessions", color: "#c7d2fe" }, { label: "Chats", color: "#6366f1" }, { label: "Activations", color: "#8b5cf6" }].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="w-3 h-3 rounded-sm" style={{ background: l.color }} />
                {l.label}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Confiance RAG moyenne</h2>
          {confData.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">Métriques quotidiennes non disponibles</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={confData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0.6, 1]} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => [`${(v * 100).toFixed(0)}%`, "Confiance"]}
                  contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                />
                <Line type="monotone" dataKey="confidence" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4, fill: "#6366f1", strokeWidth: 0 }} activeDot={{ r: 6, fill: "#4f46e5" }} />
              </LineChart>
            </ResponsiveContainer>
          )}
          <div className="mt-3 text-center text-xs text-slate-400">
            Seuil recommandé : 0.72{avgConfidence != null && ` — Actuel : `}
            {avgConfidence != null && <span className="font-semibold text-emerald-600">{avgConfidence.toFixed(2)}</span>}
          </div>
        </div>
      </div>

      {/* Top routes */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-5">Top routes — Interactions chat</h2>
        {topRoutes.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">Aucune interaction enregistrée.</p>
        ) : (
          <div className="space-y-3">
            {topRoutes.map((r) => (
              <div key={r.route} className="flex items-center gap-4">
                <code className="text-xs text-slate-600 font-mono w-52 truncate">{r.route}</code>
                <div className="flex-1 bg-slate-100 rounded-full h-2">
                  <div className="bg-gradient-to-r from-indigo-500 to-violet-500 h-2 rounded-full transition-all" style={{ width: `${r.pct}%` }} />
                </div>
                <span className="text-xs font-medium text-slate-600 w-8 text-right">{r.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Knowledge gaps alert */}
      {knowledgeGaps > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-4">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="font-semibold text-amber-800">{knowledgeGaps} gap{knowledgeGaps > 1 ? "s" : ""} de connaissance détecté{knowledgeGaps > 1 ? "s" : ""}</p>
            <p className="text-sm text-amber-700 mt-1">
              Des questions reçoivent une confiance RAG {"<"} 0.65. Allez dans{" "}
              <a href="/dashboard/knowledge" className="underline">Knowledge Base</a>{" "}
              pour relancer un crawl ou ajouter des chunks manuellement.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
