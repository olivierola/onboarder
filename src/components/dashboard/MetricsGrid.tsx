import { TrendingUp, TrendingDown } from "lucide-react"
import { MetricsData } from "@/lib/types"

interface Props {
  data: MetricsData
}

function healthBg(health: "good" | "warning" | "bad") {
  if (health === "warning") return "bg-amber-50 border-amber-100"
  if (health === "bad") return "bg-red-50 border-red-100"
  return "bg-white border-slate-100"
}

function fmt(v: number | null, suffix = ""): string {
  if (v == null) return "—"
  return `${v}${suffix}`
}

export function MetricsGrid({ data }: Props) {
  const activationHealth: "good" | "warning" | "bad" =
    data.activationRate == null ? "good"
    : data.activationRate >= 30 ? "good"
    : data.activationRate >= 15 ? "warning"
    : "bad"

  const ragHealth: "good" | "warning" | "bad" =
    data.ragConfidence == null ? "good"
    : data.ragConfidence >= 0.72 ? "good"
    : "warning"

  const gapsHealth: "good" | "warning" | "bad" =
    data.knowledgeGaps === 0 ? "good"
    : data.knowledgeGaps < 5 ? "warning"
    : "bad"

  const metrics = [
    {
      label: "Taux d'activation",
      value: data.activationRate != null ? `${data.activationRate.toFixed(1)}%` : "—",
      sub: data.totalSessions > 0 ? `sur ${data.totalSessions.toLocaleString()} sessions` : "Pas encore de données",
      health: activationHealth,
      icon: "🎯",
    },
    {
      label: "Confiance RAG moy.",
      value: data.ragConfidence != null ? data.ragConfidence.toFixed(2) : "—",
      sub: "Seuil recommandé : 0.72",
      health: ragHealth,
      icon: "🧠",
    },
    {
      label: "Engagement widget",
      value: data.engagementPct != null ? `${data.engagementPct.toFixed(1)}%` : "—",
      sub: "Sessions avec interaction chat",
      health: (data.engagementPct ?? 100) >= 15 ? "good" : "warning",
      icon: "💬",
    },
    {
      label: "Actions / session",
      value: data.actionsPerSession != null ? data.actionsPerSession.toFixed(1) : "—",
      sub: "Moyenne globale",
      health: "good" as const,
      icon: "🎬",
    },
    {
      label: "Gaps Knowledge",
      value: String(data.knowledgeGaps),
      sub: "Questions sans réponse adéquate",
      health: gapsHealth,
      icon: "⚠️",
    },
    {
      label: "Sessions totales",
      value: data.totalSessions > 0 ? data.totalSessions.toLocaleString() : "—",
      sub: "Toutes périodes confondues",
      health: "good" as const,
      icon: "👤",
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {metrics.map((m) => (
        <div
          key={m.label}
          className={`rounded-2xl border p-5 shadow-sm ${healthBg(m.health)}`}
        >
          <div className="flex items-start justify-between mb-2">
            <span className="text-xl">{m.icon}</span>
            {m.health === "warning" && (
              <span className="text-xs font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                Attention
              </span>
            )}
            {m.health === "bad" && (
              <span className="text-xs font-medium text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                Critique
              </span>
            )}
          </div>
          <div className="text-2xl font-bold text-slate-900">{m.value}</div>
          <div className="text-sm font-medium text-slate-700 mt-0.5">{m.label}</div>
          <div className="text-xs text-slate-400 mt-1">{m.sub}</div>
        </div>
      ))}
    </div>
  )
}
