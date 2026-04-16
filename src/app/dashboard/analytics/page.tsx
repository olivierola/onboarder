import { Header } from "@/components/layout/Header"
import { AnalyticsCharts } from "@/components/dashboard/AnalyticsCharts"
import { createServiceClient, getWorkspaceId } from "@/lib/supabase-server"

export default async function AnalyticsPage() {
  const db = createServiceClient()
  const wsId = getWorkspaceId()

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  sevenDaysAgo.setHours(0, 0, 0, 0)
  const sevenDaysAgoStr = sevenDaysAgo.toISOString()
  const sevenDaysAgoDate = sevenDaysAgo.toISOString().split("T")[0]

  const [
    { data: sessions },
    { data: events },
    { data: confMetrics },
    { count: knowledgeGaps },
  ] = await Promise.all([
    db
      .from("onboarder_sessions")
      .select("created_at, activated")
      .eq("workspace_id", wsId)
      .gte("created_at", sevenDaysAgoStr),
    db
      .from("onboarder_events")
      .select("event_type, route, session_id, ts")
      .eq("workspace_id", wsId)
      .gte("ts", sevenDaysAgoStr),
    db
      .from("onboarder_metrics_daily")
      .select("date, value")
      .eq("workspace_id", wsId)
      .eq("metric", "rag_confidence_avg")
      .gte("date", sevenDaysAgoDate)
      .order("date"),
    db
      .from("onboarder_events")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", wsId)
      .in("event_type", ["low_confidence", "no_answer"])
      .gte("ts", sevenDaysAgoStr),
  ])

  // Build daily data map for last 7 days
  const dateMap = new Map<
    string,
    { date: string; sessions: number; chats: number; activations: number }
  >()
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const isoDay = d.toISOString().split("T")[0]
    const label = d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
    })
    dateMap.set(isoDay, { date: label, sessions: 0, chats: 0, activations: 0 })
  }

  sessions?.forEach((s) => {
    const day = new Date(s.created_at).toISOString().split("T")[0]
    const entry = dateMap.get(day)
    if (entry) {
      entry.sessions++
      if (s.activated) entry.activations++
    }
  })

  events?.forEach((e) => {
    const day = new Date(e.ts).toISOString().split("T")[0]
    const entry = dateMap.get(day)
    if (entry && e.event_type === "chat_interaction") entry.chats++
  })

  const dailyData = Array.from(dateMap.values())

  // Confidence trend from metrics_daily
  const confData =
    confMetrics?.map((m) => ({
      date: new Date(m.date).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
      }),
      confidence: m.value,
    })) ?? []

  const avgConfidence =
    confData.length > 0 ? confData[confData.length - 1].confidence : null

  // Top routes by chat interaction count
  const routeMap = new Map<string, number>()
  events
    ?.filter((e) => e.event_type === "chat_interaction" && e.route)
    .forEach((e) => {
      routeMap.set(e.route!, (routeMap.get(e.route!) ?? 0) + 1)
    })

  const sortedRoutes = Array.from(routeMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const maxCount = Math.max(...sortedRoutes.map(([, c]) => c), 1)
  const topRoutes = sortedRoutes.map(([route, count]) => ({
    route,
    count,
    pct: Math.round((count / maxCount) * 100),
  }))

  // Summary totals
  const totalSessions = sessions?.length ?? 0
  const totalChats =
    events?.filter((e) => e.event_type === "chat_interaction").length ?? 0
  const totalActivations = sessions?.filter((s) => s.activated).length ?? 0
  const activationRate =
    totalSessions > 0
      ? ((totalActivations / totalSessions) * 100).toFixed(1)
      : "0"

  const summary = { totalSessions, totalChats, totalActivations, activationRate }

  return (
    <div>
      <Header title="Analytics" subtitle="7 derniers jours" />
      <div className="p-8">
        <AnalyticsCharts
          dailyData={dailyData}
          confData={confData}
          topRoutes={topRoutes}
          summary={summary}
          knowledgeGaps={knowledgeGaps ?? 0}
          avgConfidence={avgConfidence}
        />
      </div>
    </div>
  )
}
