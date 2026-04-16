"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import {
  Map, ChevronDown, ChevronRight, AlertCircle,
  Globe, Layout, Layers, Component, MousePointer,
  Link as LinkIcon, Target, Lightbulb, Shield,
  ArrowRight, Crosshair,
} from "lucide-react"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Types (subset of AppTree) ───────────────────────────────────────────────

interface SelectorSet {
  primary  : Record<string, string>
  fallbacks: Array<Record<string, string>>
}

interface NodeContext {
  user_goal ?: string
  importance?: string
  step      ?: string
}

interface Relation {
  type  : string
  target: string
}

interface TreeNode {
  type               : string
  name               : string
  description        : string
  selectors          : SelectorSet
  selector_confidence: number
  actions           ?: string[]
  context           ?: NodeContext
  relations         ?: Relation[]
  ai_hint           ?: string
  children          ?: TreeNode[]
}

interface TreeSection {
  name               : string
  description        : string
  type               : string
  selectors          : SelectorSet
  selector_confidence: number
  components         : TreeNode[]
}

interface TreePage {
  id           : string
  route        : string
  title        : string
  description  : string
  auth_required: boolean
  sections     : TreeSection[]
}

interface AppRoute {
  path        : string
  name        : string
  description : string
  auth_required: boolean
  pages       : TreePage[]
}

interface AppTree {
  app: {
    name       : string
    description: string
    base_url   : string
    framework  : string
  }
  routes          : AppRoute[]
  generated_at    : string
  total_sections  : number
  total_components: number
}

// ─── Importance badge ────────────────────────────────────────────────────────

const IMPORTANCE_STYLE: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high    : "bg-orange-100 text-orange-700 border-orange-200",
  medium  : "bg-yellow-100 text-yellow-700 border-yellow-200",
  low     : "bg-slate-100 text-slate-500 border-slate-200",
}

function ImportanceBadge({ value }: { value: string }) {
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${IMPORTANCE_STYLE[value] ?? IMPORTANCE_STYLE.low}`}>
      {value}
    </span>
  )
}

// ─── Selector display ────────────────────────────────────────────────────────

function SelectorPill({ sel, confidence }: { sel: SelectorSet; confidence: number }) {
  const [key, val] = Object.entries(sel.primary ?? {})[0] ?? []
  if (!key) return null
  const conf = Math.round(confidence * 100)
  const color = conf >= 90 ? "text-emerald-600" : conf >= 70 ? "text-amber-600" : "text-slate-400"
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
      <Crosshair className={`w-2.5 h-2.5 ${color}`} />
      {key}=&quot;{String(val).slice(0, 30)}&quot;
      <span className={`${color} font-semibold`}>{conf}%</span>
    </span>
  )
}

// ─── Component node ──────────────────────────────────────────────────────────

const NODE_COLOR: Record<string, string> = {
  button  : "border-indigo-200 bg-indigo-50/50",
  input   : "border-cyan-200 bg-cyan-50/50",
  select  : "border-cyan-200 bg-cyan-50/50",
  link    : "border-sky-200 bg-sky-50/50",
  form    : "border-violet-200 bg-violet-50/50",
  card    : "border-purple-200 bg-purple-50/50",
  table   : "border-emerald-200 bg-emerald-50/50",
  tabs    : "border-teal-200 bg-teal-50/50",
  menu    : "border-orange-200 bg-orange-50/50",
  modal   : "border-rose-200 bg-rose-50/50",
  default : "border-slate-200 bg-white",
}

const NODE_ICON: Record<string, React.ReactNode> = {
  button : <MousePointer className="w-3 h-3 text-indigo-500" />,
  input  : <Component className="w-3 h-3 text-cyan-500" />,
  link   : <LinkIcon className="w-3 h-3 text-sky-500" />,
  form   : <Layers className="w-3 h-3 text-violet-500" />,
  default: <Component className="w-3 h-3 text-slate-400" />,
}

function ComponentNode({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  const [open, setOpen] = useState(depth === 0)
  const hasChildren = (node.children?.length ?? 0) > 0
  const color = NODE_COLOR[node.type] ?? NODE_COLOR.default
  const icon  = NODE_ICON[node.type]  ?? NODE_ICON.default

  return (
    <div className={`rounded-lg border ${color} overflow-hidden`}>
      {/* Header row */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-black/[0.02] transition-colors"
      >
        {hasChildren
          ? open
            ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          : <span className="w-3.5 h-3.5 shrink-0" />
        }
        {icon}
        <span className="text-xs font-semibold text-slate-800 truncate">{node.name}</span>
        <span className="text-[10px] text-slate-400 shrink-0">{node.type}</span>
        {node.context?.importance && (
          <ImportanceBadge value={node.context.importance} />
        )}
        <SelectorPill sel={node.selectors} confidence={node.selector_confidence} />
      </button>

      {/* Expanded body */}
      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-black/5">
          {/* Description */}
          {node.description && (
            <p className="text-xs text-slate-600 pt-2 leading-relaxed">{node.description}</p>
          )}

          {/* Context */}
          {node.context?.user_goal && (
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <Target className="w-3 h-3 text-indigo-400 shrink-0" />
              <span>Goal:</span>
              <span className="font-mono text-indigo-700">{node.context.user_goal}</span>
              {node.context.step && (
                <span className="ml-1 text-slate-400">· {node.context.step}</span>
              )}
            </div>
          )}

          {/* Actions */}
          {node.actions && node.actions.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {node.actions.map(a => (
                <span key={a} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">{a}</span>
              ))}
            </div>
          )}

          {/* Relations */}
          {node.relations && node.relations.length > 0 && (
            <div className="flex flex-col gap-1">
              {node.relations.map((r, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[10px]">
                  <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
                  <span className="text-slate-400">{r.type}</span>
                  <span className="font-mono text-violet-700">{r.target}</span>
                </div>
              ))}
            </div>
          )}

          {/* AI hint */}
          {node.ai_hint && (
            <div className="flex items-start gap-1.5 text-[10px] bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
              <Lightbulb className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
              <span className="text-amber-800 leading-relaxed">{node.ai_hint}</span>
            </div>
          )}

          {/* Fallback selectors */}
          {node.selectors.fallbacks?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-[10px] text-slate-400">fallbacks:</span>
              {node.selectors.fallbacks.slice(0, 3).map((f, i) => {
                const [k, v] = Object.entries(f)[0] ?? []
                return (
                  <span key={i} className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                    {k}=&quot;{String(v).slice(0, 20)}&quot;
                  </span>
                )
              })}
            </div>
          )}

          {/* Children */}
          {hasChildren && (
            <div className="space-y-1.5 pt-1 pl-3 border-l-2 border-slate-100">
              {node.children!.map((child, i) => (
                <ComponentNode key={i} node={child} depth={depth + 1} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Section ─────────────────────────────────────────────────────────────────

const SECTION_COLOR: Record<string, string> = {
  header  : "bg-blue-50 border-blue-200",
  sidebar : "bg-slate-50 border-slate-200",
  footer  : "bg-slate-50 border-slate-200",
  modal   : "bg-rose-50 border-rose-200",
  section : "bg-white border-slate-200",
}

const SECTION_ICON: Record<string, React.ReactNode> = {
  header  : <Layout className="w-3.5 h-3.5 text-blue-500" />,
  sidebar : <Layers className="w-3.5 h-3.5 text-slate-500" />,
  footer  : <Layout className="w-3.5 h-3.5 text-slate-400" />,
  modal   : <Component className="w-3.5 h-3.5 text-rose-500" />,
  section : <Layers className="w-3.5 h-3.5 text-indigo-400" />,
}

function SectionNode({ section }: { section: TreeSection }) {
  const [open, setOpen] = useState(true)
  const color = SECTION_COLOR[section.type] ?? SECTION_COLOR.section
  const icon  = SECTION_ICON[section.type]  ?? SECTION_ICON.section

  return (
    <div className={`rounded-xl border ${color} overflow-hidden`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-black/[0.02] transition-colors"
      >
        {open
          ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
        }
        {icon}
        <span className="text-sm font-semibold text-slate-800">{section.name}</span>
        <span className="text-xs text-slate-400">{section.type}</span>
        <span className="ml-auto text-xs text-slate-400 shrink-0">
          {section.components.length} composant{section.components.length > 1 ? "s" : ""}
        </span>
        <SelectorPill sel={section.selectors} confidence={section.selector_confidence} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-black/5">
          {section.description && (
            <p className="text-xs text-slate-500 pt-3 pb-1 leading-relaxed">{section.description}</p>
          )}
          <div className="space-y-2">
            {section.components.map((comp, i) => (
              <ComponentNode key={i} node={comp} depth={0} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Route / Page ─────────────────────────────────────────────────────────────

function RouteNode({ route }: { route: AppRoute }) {
  const [open, setOpen] = useState(false)
  const page = route.pages[0]
  const sectionCount   = page?.sections?.length ?? 0
  const componentCount = page?.sections?.reduce((n, s) => n + s.components.length, 0) ?? 0

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Route header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        {open
          ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
        }
        <Globe className="w-4 h-4 text-indigo-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900">{route.name}</span>
            <span className="text-xs font-mono text-slate-400">{route.path}</span>
            {route.auth_required && (
              <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">
                <Shield className="w-2.5 h-2.5" /> auth
              </span>
            )}
          </div>
          {route.description && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">{route.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 text-xs text-slate-400">
          <span>{sectionCount} sections</span>
          <span>{componentCount} composants</span>
        </div>
      </button>

      {/* Page sections */}
      {open && page && (
        <div className="px-5 pb-5 space-y-3 border-t border-slate-100">
          {page.description && (
            <p className="text-xs text-slate-500 pt-3 leading-relaxed">{page.description}</p>
          )}
          {page.sections.length === 0 && (
            <p className="text-xs text-slate-400 italic pt-3">Aucune section détectée pour cette page.</p>
          )}
          {page.sections.map((section, i) => (
            <SectionNode key={i} section={section} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function MapPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [tree, setTree]     = useState<AppTree | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error: err } = await supabase
        .from("onboarder_manifests")
        .select("tree, updated_at")
        .eq("project_id", projectId)
        .maybeSingle()

      if (err) {
        setError(err.message)
      } else if (!data?.tree || Object.keys(data.tree).length === 0) {
        setError("Aucune carte générée. Lancez un scan de code source d'abord.")
      } else {
        setTree(data.tree as AppTree)
      }
      setLoading(false)
    }
    load()
  }, [projectId])

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Chargement de la carte…</span>
        </div>
      </div>
    )
  }

  if (error || !tree) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-start gap-3 text-red-700 text-sm max-w-xl">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>{error ?? "Carte introuvable."}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 min-h-full bg-slate-50">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Map className="w-5 h-5 text-indigo-500" />
            <h1 className="text-2xl font-bold text-slate-900">SaaS Map</h1>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            {tree.app.name} · {tree.routes.length} routes · {tree.total_sections} sections · {tree.total_components} composants
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs text-slate-400 font-mono">{tree.app.framework}</span>
          {tree.app.base_url && (
            <span className="text-xs text-slate-400 font-mono">{tree.app.base_url}</span>
          )}
          <span className="text-[10px] text-slate-300">
            Généré {new Date(tree.generated_at).toLocaleString("fr-FR")}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
        {[
          { label: "Route",     color: "bg-white border-slate-200",   icon: <Globe className="w-3 h-3 text-indigo-500" /> },
          { label: "Section",   color: "bg-slate-50 border-slate-200", icon: <Layers className="w-3 h-3 text-slate-500" /> },
          { label: "Composant", color: "bg-white border-slate-200",    icon: <Component className="w-3 h-3 text-slate-400" /> },
          { label: "Critique",  color: "bg-red-100 border-red-200",    icon: null },
          { label: "Élevé",     color: "bg-orange-100 border-orange-200", icon: null },
        ].map(({ label, color, icon }) => (
          <div key={label} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${color}`}>
            {icon}
            {label}
          </div>
        ))}
      </div>

      {/* Routes tree */}
      <div className="space-y-4">
        {tree.routes.map((route, i) => (
          <RouteNode key={i} route={route} />
        ))}
      </div>

    </div>
  )
}
