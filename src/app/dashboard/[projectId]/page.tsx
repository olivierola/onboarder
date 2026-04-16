export const dynamic = "force-dynamic"

import { createClient } from "@supabase/supabase-js"
import { BarChart3, Users, MessageSquare, Activity, Layers, Globe } from "lucide-react"

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [
    { data: project },
    { count: sessionsToday },
    { count: chatsToday },
    { count: totalSessions },
    { data: recentEvents },
  ] = await Promise.all([
    db.from("onboarder_projects")
      .select("id, name, url, status, chunk_count, routes_crawled, last_crawled_at")
      .eq("id", projectId).maybeSingle(),
    db.from("onboarder_sessions")
      .select("*", { count: "exact", head: true })
      .eq("project_id", projectId)
      .gte("created_at", today.toISOString()),
    db.from("onboarder_events")
      .select("*", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("event_type", "chat_interaction")
      .gte("ts", today.toISOString()),
    db.from("onboarder_sessions")
      .select("*", { count: "exact", head: true })
      .eq("project_id", projectId),
    db.from("onboarder_events")
      .select("id, event_type, route, ts")
      .eq("project_id", projectId)
      .order("ts", { ascending: false })
      .limit(10),
  ])

  const stats = [
    { label: "Sessions aujourd'hui", value: sessionsToday ?? 0, icon: Users, color: "text-indigo-600 bg-indigo-100" },
    { label: "Interactions chat", value: chatsToday ?? 0, icon: MessageSquare, color: "text-violet-600 bg-violet-100" },
    { label: "Sessions totales", value: totalSessions ?? 0, icon: Activity, color: "text-orange-600 bg-orange-100" },
    { label: "Chunks indexés", value: project?.chunk_count ?? 0, icon: Layers, color: "text-emerald-600 bg-emerald-100" },
  ]

  const STATUS_COLOR: Record<string, string> = {
    idle: "bg-gray-100 text-gray-600",
    crawling: "bg-yellow-100 text-yellow-700",
    ready: "bg-emerald-100 text-emerald-700",
    error: "bg-red-100 text-red-600",
  }
  const STATUS_LABEL: Record<string, string> = {
    idle: "En attente", crawling: "Crawl en cours", ready: "Prêt", error: "Erreur",
  }
  const status = project?.status ?? "idle"

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-slate-900">{project?.name}</h1>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLOR[status]}`}>
            {STATUS_LABEL[status]}
          </span>
        </div>
        <p className="text-sm text-slate-400 flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5" /> {project?.url}
          {project?.last_crawled_at && (
            <span className="ml-3 text-slate-300">
              · Crawlé le {new Date(project.last_crawled_at).toLocaleDateString("fr")}
            </span>
          )}
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>
              <s.icon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-slate-900">{s.value}</div>
              <div className="text-xs text-slate-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Routes crawlées */}
      {(project?.routes_crawled?.length ?? 0) > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-slate-400" /> Routes indexées ({project!.routes_crawled.length})
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {project!.routes_crawled.map((r: string) => (
              <span key={r} className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-mono">
                {r}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Activité récente */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">Activité récente</h2>
        {(recentEvents ?? []).length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">
            Aucune activité — indexez votre app et intégrez le snippet pour commencer.
          </p>
        ) : (
          <div className="space-y-3">
            {(recentEvents ?? []).map((e) => (
              <div key={e.id} className="flex items-center gap-4 py-2 border-b border-slate-50 last:border-0">
                <div className="w-2 h-2 bg-indigo-400 rounded-full flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-slate-700">{e.event_type}</span>
                  {e.route && <span className="text-xs text-slate-400 ml-2">· {e.route}</span>}
                </div>
                <div className="text-xs text-slate-400 flex-shrink-0">
                  {new Date(e.ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
