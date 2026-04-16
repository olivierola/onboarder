"use server"
import { createServiceClient, getWorkspaceId } from "@/lib/supabase-server"
import { revalidatePath } from "next/cache"

export interface ConfigFormData {
  appName: string
  appUrl: string
  locale: string
  tone: string
  proactivityDelay: number
  agentName: string
  agentEmoji: string
  primaryColor: string
  widgetPosition: string
  minConfidence: number
  retentionDays: number
}

export async function saveConfig(data: ConfigFormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const db = createServiceClient()
    const wsId = getWorkspaceId()
    const { error } = await db.from("onboarder_configs").upsert({
      workspace_id: wsId,
      app_name: data.appName,
      app_url: data.appUrl,
      locale: data.locale,
      tone: data.tone,
      proactivity_delay_s: data.proactivityDelay,
      branding: {
        agent_name: data.agentName,
        agent_emoji: data.agentEmoji,
        primary_color: data.primaryColor,
        widget_position: data.widgetPosition,
        min_confidence: data.minConfidence,
        retention_days: data.retentionDays,
      },
      updated_at: new Date().toISOString(),
    })
    if (error) return { ok: false, error: error.message }
    revalidatePath("/dashboard/config")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}
