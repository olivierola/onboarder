export const dynamic = "force-dynamic"

import { createClient } from "@supabase/supabase-js"
import { MessageSquare, Users, ThumbsUp, ThumbsDown, Zap } from "lucide-react"
import { CommitsGrid } from "@/components/ui/commits-grid"

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const [
    { count: totalChats },
    { count: totalSessions },
    { count: activatedSessions },
    { count: positiveFeedback },
    { count: negativeFeedback },
    { count: proactiveTriggers },
    { data: recentConversations },
  ] = await Promise.all([
    db.from("onboarder_events").select("*", { count: "exact", head: true })
      .eq("project_id", projectId).eq("event_type", "chat_interaction"),
    db.from("onboarder_sessions").select("*", { count: "exact", head: true })
      .eq("project_id", projectId),
    db.from("onboarder_sessions").select("*", { count: "exact", head: true })
      .eq("project_id", projectId).eq("activated", true),
    db.from("onboarder_events").select("*", { count: "exact", head: true })
      .eq("project_id", projectId).eq("event_type", "feedback_positive"),
    db.from("onboarder_events").select("*", { count: "exact", head: true })
      .eq("project_id", projectId).eq("event_type", "feedback_negative"),
    db.from("onboarder_events").select("*", { count: "exact", head: true })
      .eq("project_id", projectId).eq("event_type", "proactive_trigger"),
    db.from("onboarder_conversations").select("session_id, role, content, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(20),
  ])

  const total = totalSessions ?? 0
  const activated = activatedSessions ?? 0
  const activationRate = total > 0 ? Math.round((activated / total) * 100) : 0

  const stats = [
    { label: "Conversations", value: totalChats ?? 0, icon: MessageSquare, color: "text-indigo-600 bg-indigo-100" },
    { label: "Sessions", value: total, icon: Users, color: "text-violet-600 bg-violet-100" },
    { label: "Taux d'activation", value: `${activationRate}%`, icon: Zap, color: "text-orange-600 bg-orange-100" },
    { label: "Déclenchements proactifs", value: proactiveTriggers ?? 0, icon: Zap, color: "text-emerald-600 bg-emerald-100" },
  ]

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="text-sm text-slate-500 mt-1">Statistiques d'utilisation de l'agent sur ce projet.</p>
      </div>

      {/* Chat heatmap */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-1">Interactions chat</h2>
        <p className="text-xs text-slate-400 mb-4">Volume total de messages reçus par l&apos;agent</p>
        <div className="flex items-center gap-8">
          <CommitsGrid text={String(totalChats ?? 0)} />
          <div className="space-y-1">
            <div className="text-4xl font-bold text-slate-900">{totalChats ?? 0}</div>
            <div className="text-xs text-slate-500">messages envoyés à l&apos;agent</div>
            <div className="text-xs text-slate-400 mt-3">sur {totalSessions ?? 0} sessions au total</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>
              <s.icon className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Feedback */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">Feedback utilisateurs</h2>
        <div className="flex gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
              <ThumbsUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <div className="text-xl font-bold text-slate-900">{positiveFeedback ?? 0}</div>
              <div className="text-xs text-slate-500">Positifs</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center">
              <ThumbsDown className="w-4 h-4 text-red-500" />
            </div>
            <div>
              <div className="text-xl font-bold text-slate-900">{negativeFeedback ?? 0}</div>
              <div className="text-xs text-slate-500">Négatifs</div>
            </div>
          </div>
          {((positiveFeedback ?? 0) + (negativeFeedback ?? 0)) > 0 && (
            <div className="flex-1 flex items-center">
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.round(((positiveFeedback ?? 0) / ((positiveFeedback ?? 0) + (negativeFeedback ?? 0))) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent conversations */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">Conversations récentes</h2>
        {(recentConversations ?? []).length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Aucune conversation pour l'instant.</p>
        ) : (
          <div className="space-y-2">
            {(recentConversations ?? []).map((c, i) => (
              <div key={i} className={`flex gap-3 items-start py-2 border-b border-slate-50 last:border-0 ${c.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`text-xs px-2 py-0.5 rounded-full shrink-0 mt-0.5 font-medium ${c.role === "user" ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-500"}`}>
                  {c.role === "user" ? "User" : "Agent"}
                </div>
                <p className="text-sm text-slate-600 flex-1 truncate">{c.content}</p>
                <span className="text-xs text-slate-300 shrink-0">
                  {new Date(c.created_at).toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
