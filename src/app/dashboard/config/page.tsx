import { Header } from "@/components/layout/Header"
import { ConfigForm } from "@/components/dashboard/ConfigForm"
import { createServiceClient, getWorkspaceId } from "@/lib/supabase-server"

export default async function ConfigPage() {
  const db = createServiceClient()
  const wsId = getWorkspaceId()

  const { data: config } = await db
    .from("onboarder_configs")
    .select("*")
    .eq("workspace_id", wsId)
    .maybeSingle()

  interface Branding {
    widget_position?: string
    primary_color?: string
    agent_name?: string
    agent_emoji?: string
    retention_days?: number | string
    min_confidence?: number | string
  }
  const branding = (config?.branding ?? {}) as Branding

  const initialConfig = {
    appName: config?.app_name ?? "Mon SaaS",
    appUrl: config?.app_url ?? "https://app.exemple.com",
    tone: config?.tone ?? "friendly",
    locale: config?.locale ?? "fr",
    widgetPosition: branding.widget_position ?? "bottom-right",
    primaryColor: branding.primary_color ?? "#6366f1",
    agentName: branding.agent_name ?? "Assistant",
    agentEmoji: branding.agent_emoji ?? "🤖",
    retentionDays: Number(branding.retention_days ?? 30),
    minConfidence: Math.min(0.9, Math.max(0.5, Number(branding.min_confidence ?? 0.65))),
    proactivityDelay: Math.min(300, Math.max(30, config?.proactivity_delay_s ?? 90)),
  }

  return (
    <div>
      <Header
        title="Configuration"
        subtitle="Personnalisez le comportement de votre agent"
      />
      <div className="p-8 max-w-2xl">
        <ConfigForm initialConfig={initialConfig} />
      </div>
    </div>
  )
}
