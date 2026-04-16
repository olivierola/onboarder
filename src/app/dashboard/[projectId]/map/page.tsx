"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase"
import {
  Map, ChevronDown, ChevronRight, AlertCircle,
  Globe, Layers, Component, MousePointer, Navigation,
  Zap, Box, LayoutDashboard, Table, FormInput,
  BookOpen, Search, X, ChevronsUpDown, Maximize2, Minimize2,
} from "lucide-react"

const supabase = createClient()

// ─── Types ────────────────────────────────────────────────────────────────────

type NodeType =
  | "app" | "layout" | "module" | "page" | "section"
  | "component" | "action" | "input" | "modal" | "form"
  | "nav" | "table" | "card" | "button"

interface CognitiveNode {
  id              : string
  type            : NodeType
  intent          : string
  description     : string
  route?          : string | null
  urlPattern?     : string | null
  dynamicParams?  : string[]
  actionsPossible?: string[]
  prerequisites?  : string[]
  examplePrompts? : string[]
  children        : CognitiveNode[]
}

interface CognitiveTree {
  version   : string
  framework : string
  repoHash  : string
  timestamp : string
  stats     : { totalNodes: number; totalPages: number; maxDepth: number }
  root      : CognitiveNode
}

interface TreeVersion {
  version     : string
  framework   : string
  stats       : { totalNodes: number; totalPages: number; maxDepth: number }
  storage_path: string
  timestamp   : string
}

// ─── Node type config ─────────────────────────────────────────────────────────

const NODE_CFG: Record<string, {
  border: string; bg: string; badge: string; dot: string
  icon  : React.ReactNode
}> = {
  app      : { border:"border-slate-300",   bg:"bg-slate-50",    badge:"bg-slate-100 text-slate-600",   dot:"bg-slate-400",   icon:<Box            className="w-3.5 h-3.5 text-slate-500"/>},
  layout   : { border:"border-slate-200",   bg:"bg-white",       badge:"bg-slate-100 text-slate-500",   dot:"bg-slate-300",   icon:<LayoutDashboard className="w-3.5 h-3.5 text-slate-400"/>},
  module   : { border:"border-purple-200",  bg:"bg-purple-50/60",badge:"bg-purple-100 text-purple-700", dot:"bg-purple-400",  icon:<Layers         className="w-3.5 h-3.5 text-purple-500"/>},
  page     : { border:"border-indigo-200",  bg:"bg-indigo-50/60",badge:"bg-indigo-100 text-indigo-700", dot:"bg-indigo-400",  icon:<Globe          className="w-3.5 h-3.5 text-indigo-500"/>},
  section  : { border:"border-sky-200",     bg:"bg-sky-50/40",   badge:"bg-sky-100 text-sky-700",       dot:"bg-sky-400",     icon:<Layers         className="w-3.5 h-3.5 text-sky-500"/>},
  component: { border:"border-teal-200",    bg:"bg-teal-50/40",  badge:"bg-teal-100 text-teal-700",     dot:"bg-teal-400",    icon:<Component      className="w-3.5 h-3.5 text-teal-500"/>},
  action   : { border:"border-amber-200",   bg:"bg-amber-50/40", badge:"bg-amber-100 text-amber-700",   dot:"bg-amber-400",   icon:<Zap            className="w-3.5 h-3.5 text-amber-500"/>},
  input    : { border:"border-orange-200",  bg:"bg-orange-50/40",badge:"bg-orange-100 text-orange-700", dot:"bg-orange-400",  icon:<FormInput      className="w-3.5 h-3.5 text-orange-500"/>},
  modal    : { border:"border-rose-200",    bg:"bg-rose-50/40",  badge:"bg-rose-100 text-rose-700",     dot:"bg-rose-400",    icon:<MousePointer   className="w-3.5 h-3.5 text-rose-500"/>},
  form     : { border:"border-violet-200",  bg:"bg-violet-50/40",badge:"bg-violet-100 text-violet-700", dot:"bg-violet-400",  icon:<FormInput      className="w-3.5 h-3.5 text-violet-500"/>},
  nav      : { border:"border-cyan-200",    bg:"bg-cyan-50/40",  badge:"bg-cyan-100 text-cyan-700",     dot:"bg-cyan-400",    icon:<Navigation     className="w-3.5 h-3.5 text-cyan-500"/>},
  table    : { border:"border-emerald-200", bg:"bg-emerald-50/40",badge:"bg-emerald-100 text-emerald-700",dot:"bg-emerald-400",icon:<Table          className="w-3.5 h-3.5 text-emerald-500"/>},
  card     : { border:"border-blue-200",    bg:"bg-blue-50/40",  badge:"bg-blue-100 text-blue-700",     dot:"bg-blue-400",    icon:<Box            className="w-3.5 h-3.5 text-blue-500"/>},
  button   : { border:"border-yellow-200",  bg:"bg-yellow-50/40",badge:"bg-yellow-100 text-yellow-700", dot:"bg-yellow-400",  icon:<MousePointer   className="w-3.5 h-3.5 text-yellow-600"/>},
}

const DEFAULT_CFG = NODE_CFG.component

// ─── Search match ─────────────────────────────────────────────────────────────

function nodeMatches(node: CognitiveNode, q: string): boolean {
  return (
    node.intent.toLowerCase().includes(q)      ||
    node.description.toLowerCase().includes(q) ||
    node.id.toLowerCase().includes(q)          ||
    (node.route?.toLowerCase().includes(q) ?? false)
  )
}

function treeHasMatch(node: CognitiveNode, q: string): boolean {
  if (!q) return true
  if (nodeMatches(node, q)) return true
  return node.children.some(c => treeHasMatch(c, q))
}

// ─── Tree node (recursive) ───────────────────────────────────────────────────

function TreeNodeRow({
  node,
  depth,
  searchQuery,
  forceOpen,
}: {
  node        : CognitiveNode
  depth       : number
  searchQuery : string
  forceOpen   : boolean
}) {
  const cfg         = NODE_CFG[node.type] ?? DEFAULT_CFG
  const hasChildren = node.children.length > 0
  const hasMatch    = searchQuery ? treeHasMatch(node, searchQuery) : true
  const selfMatch   = searchQuery ? nodeMatches(node, searchQuery) : false

  const [open, setOpen] = useState(depth < 2)

  // Sync with forceOpen toggle
  useEffect(() => { setOpen(forceOpen) }, [forceOpen])

  // Auto-open when search finds a descendant
  useEffect(() => {
    if (searchQuery && treeHasMatch(node, searchQuery)) setOpen(true)
  }, [searchQuery, node])

  if (!hasMatch) return null

  const indent = depth * 20

  return (
    <div>
      {/* Row */}
      <div
        className={`flex items-center gap-2 py-1.5 pr-3 rounded-lg cursor-pointer
          hover:bg-slate-100/80 transition-colors group
          ${selfMatch && searchQuery ? "bg-indigo-50 ring-1 ring-indigo-200" : ""}
        `}
        style={{ paddingLeft: `${indent + 8}px` }}
        onClick={() => hasChildren && setOpen(o => !o)}
      >
        {/* Expand icon */}
        <span className="w-4 h-4 shrink-0 flex items-center justify-center">
          {hasChildren
            ? open
              ? <ChevronDown  className="w-3.5 h-3.5 text-slate-400" />
              : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            : <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          }
        </span>

        {/* Type icon */}
        {cfg.icon}

        {/* Intent */}
        <span className={`text-sm font-medium flex-1 truncate ${selfMatch && searchQuery ? "text-indigo-900" : "text-slate-800"}`}>
          {node.intent}
        </span>

        {/* Route badge */}
        {node.route && (
          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0 max-w-[180px] truncate hidden sm:block">
            {node.route}
          </span>
        )}

        {/* Type badge */}
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${cfg.badge}`}>
          {node.type}
        </span>

        {/* Children count */}
        {hasChildren && (
          <span className="text-[10px] text-slate-400 shrink-0">{node.children.length}</span>
        )}
      </div>

      {/* Detail strip (shown when leaf or first open) */}
      {open && !hasChildren && node.description && (
        <div
          className="ml-1 mr-3 mb-1 px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-500 leading-relaxed"
          style={{ marginLeft: `${indent + 32}px` }}
        >
          <p>{node.description}</p>
          {node.actionsPossible && node.actionsPossible.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {node.actionsPossible.map(a => (
                <span key={a} className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-mono text-[10px]">{a}</span>
              ))}
            </div>
          )}
          {node.examplePrompts && node.examplePrompts.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {node.examplePrompts.slice(0, 2).map((p, i) => (
                <li key={i} className="text-indigo-600 text-[10px]">› {p}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Children */}
      {open && hasChildren && (
        <div className={`border-l border-slate-200 ml-${Math.min(depth + 2, 8)}`}
          style={{ marginLeft: `${indent + 18}px` }}
        >
          {node.children.map(child => (
            <TreeNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              searchQuery={searchQuery}
              forceOpen={forceOpen}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MapPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [tree, setTree]           = useState<CognitiveTree | null>(null)
  const [version, setVersion]     = useState<TreeVersion | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [search, setSearch]       = useState("")
  const [allOpen, setAllOpen]     = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)

      // 1. Latest tree version metadata
      const { data: v, error: vErr } = await supabase
        .from("cognitive_tree_versions")
        .select("version, framework, stats, storage_path, timestamp")
        .eq("project_id", projectId)
        .order("timestamp", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (vErr) { setError(vErr.message); setLoading(false); return }
      if (!v)   { setError("Aucune carte — lancez un scan de code source."); setLoading(false); return }

      // 2. Signed URL → fetch JSON directly
      const { data: signed, error: sErr } = await supabase
        .storage.from("cognitive-trees")
        .createSignedUrl(v.storage_path, 3600)

      if (sErr || !signed?.signedUrl) {
        setError(sErr?.message ?? "Impossible d'obtenir l'URL de téléchargement")
        setLoading(false)
        return
      }

      const res = await fetch(signed.signedUrl)
      if (!res.ok) { setError(`Téléchargement échoué: ${res.statusText}`); setLoading(false); return }

      const treeData: CognitiveTree = await res.json()
      setVersion(v)
      setTree(treeData)
      setLoading(false)
    }
    load()
  }, [projectId])

  const toggleAll = useCallback(() => setAllOpen(o => !o), [])

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Chargement de l'arbre cognitif…</span>
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
    <div className="p-6 space-y-4 min-h-full bg-slate-50">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Map className="w-5 h-5 text-indigo-500" />
            <h1 className="text-2xl font-bold text-slate-900">SaaS Map</h1>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-mono">
              {version?.framework}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            {version?.stats?.totalNodes?.toLocaleString()} nœuds ·{" "}
            {version?.stats?.totalPages} pages · profondeur {version?.stats?.maxDepth} ·{" "}
            v{version?.version?.replace("sha:", "").slice(0, 8)}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>{new Date(version?.timestamp ?? "").toLocaleString("fr-FR")}</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un nœud…"
            className="outline-none bg-transparent w-full text-sm text-slate-700 placeholder:text-slate-400"
          />
          {search && (
            <button onClick={() => setSearch("")}>
              <X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
            </button>
          )}
        </div>

        {/* Expand / collapse all */}
        <button
          onClick={toggleAll}
          className="flex items-center gap-1.5 text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm hover:bg-slate-50 transition-colors text-slate-600"
        >
          {allOpen
            ? <><Minimize2 className="w-3.5 h-3.5" /> Tout réduire</>
            : <><Maximize2 className="w-3.5 h-3.5" /> Tout déplier</>
          }
        </button>

        {/* Legend */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(["page","section","component","action","modal"] as NodeType[]).map(t => {
            const c = NODE_CFG[t]
            return (
              <span key={t} className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border ${c.border} ${c.bg}`}>
                {c.icon}{t}
              </span>
            )
          })}
        </div>
      </div>

      {/* Tree */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3">
          <TreeNodeRow
            node={tree.root}
            depth={0}
            searchQuery={search.toLowerCase().trim()}
            forceOpen={allOpen}
          />
        </div>
      </div>

    </div>
  )
}
