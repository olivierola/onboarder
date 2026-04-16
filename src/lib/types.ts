export type ChunkType = 'element' | 'page' | 'flow'

export interface DbChunk {
  id: string
  workspace_id: string
  chunk_type: ChunkType
  route: string
  route_title: string | null
  element_id: string | null
  selector: string | null
  element_type: string | null
  label: string | null
  content: string
  chunk_text: string
  metadata: Record<string, unknown>
  version: number
  created_at: string
  updated_at: string
}

export interface DbSession {
  id: string
  workspace_id: string
  end_user_id: string
  activated: boolean
  completed_steps: string[]
  visited_routes: string[]
  used_features: string[]
  conversation_turns: number
  last_active_at: string
  created_at: string
}

export interface DbEvent {
  id: string
  workspace_id: string
  session_id: string | null
  end_user_id: string | null
  event_type: string
  route: string | null
  element_id: string | null
  payload: Record<string, unknown>
  rag_sources: string[]
  ts: string
}

export interface DbConfig {
  workspace_id: string
  app_name: string | null
  app_url: string | null
  activation_conditions: Record<string, unknown>
  tone: string
  proactivity_delay_s: number
  branding: {
    agent_name?: string
    agent_emoji?: string
    primary_color?: string
    widget_position?: string
    min_confidence?: number
    retention_days?: number
  }
  embedding_model: string
  llm_model: string
  locale: string
  created_at: string
  updated_at: string
}

export interface DbWorkspace {
  id: string
  owner_id: string
  name: string
  domain: string | null
  pub_token: string
  plan: string
  created_at: string
}

export interface DbMetricDaily {
  workspace_id: string
  date: string
  metric: string
  value: number
}

export interface MetricsData {
  activationRate: number | null
  ragConfidence: number | null
  engagementPct: number | null
  actionsPerSession: number | null
  knowledgeGaps: number
  totalSessions: number
}
