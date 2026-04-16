import { Header } from "@/components/layout/Header"
import { KnowledgeTable } from "@/components/dashboard/KnowledgeTable"
import { createServiceClient, getWorkspaceId } from "@/lib/supabase-server"

export default async function KnowledgePage() {
  const db = createServiceClient()
  const wsId = getWorkspaceId()

  const [{ data: chunks, count: totalChunks }, { data: confMetric }] =
    await Promise.all([
      db
        .from("onboarder_chunks")
        .select("id, chunk_type, route, label, selector, metadata, updated_at", {
          count: "exact",
        })
        .eq("workspace_id", wsId)
        .order("updated_at", { ascending: false })
        .limit(200),
      db
        .from("onboarder_metrics_daily")
        .select("value")
        .eq("workspace_id", wsId)
        .eq("metric", "rag_confidence_avg")
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

  const uniqueRoutes = new Set((chunks ?? []).map((c) => c.route)).size

  return (
    <div>
      <Header
        title="Knowledge Base"
        subtitle="Base de connaissance vectorisée de votre application"
      />
      <div className="p-8">
        <KnowledgeTable
          chunks={chunks ?? []}
          totalCount={totalChunks ?? 0}
          uniqueRoutes={uniqueRoutes}
          avgConfidence={confMetric?.value ?? null}
        />
      </div>
    </div>
  )
}
