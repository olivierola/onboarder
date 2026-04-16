"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase"
import {
  BookOpen, Search, X, ChevronRight, Layers,
  FileText, Zap, MousePointer, Navigation, Component,
  AlertCircle, Box, Table, FormInput, LayoutDashboard,
} from "lucide-react"

const supabase = createClient()

// ─── Types (mirrors CognitiveNode from _shared/cognitive-tree.ts) ────────────

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
  id          : string
  version     : string
  framework   : string
  stats       : { totalNodes: number; totalPages: number; maxDepth: number }
  storage_path: string
  timestamp   : string
}

// ─── Node type display config ────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  app      : { bg: "bg-slate-100",  text: "text-slate-700",  icon: <Box            className="w-3 h-3" /> },
  layout   : { bg: "bg-slate-100",  text: "text-slate-600",  icon: <LayoutDashboard className="w-3 h-3" /> },
  module   : { bg: "bg-purple-50",  text: "text-purple-700", icon: <Layers         className="w-3 h-3" /> },
  page     : { bg: "bg-indigo-50",  text: "text-indigo-700", icon: <FileText       className="w-3 h-3" /> },
  section  : { bg: "bg-sky-50",     text: "text-sky-700",    icon: <Layers         className="w-3 h-3" /> },
  component: { bg: "bg-teal-50",    text: "text-teal-700",   icon: <Component      className="w-3 h-3" /> },
  action   : { bg: "bg-amber-50",   text: "text-amber-700",  icon: <Zap            className="w-3 h-3" /> },
  input    : { bg: "bg-orange-50",  text: "text-orange-700", icon: <FormInput      className="w-3 h-3" /> },
  modal    : { bg: "bg-pink-50",    text: "text-pink-700",   icon: <MousePointer   className="w-3 h-3" /> },
  form     : { bg: "bg-rose-50",    text: "text-rose-700",   icon: <FormInput      className="w-3 h-3" /> },
  nav      : { bg: "bg-violet-50",  text: "text-violet-700", icon: <Navigation     className="w-3 h-3" /> },
  table    : { bg: "bg-emerald-50", text: "text-emerald-700",icon: <Table          className="w-3 h-3" /> },
  card     : { bg: "bg-cyan-50",    text: "text-cyan-700",   icon: <Box            className="w-3 h-3" /> },
  button   : { bg: "bg-yellow-50",  text: "text-yellow-700", icon: <Zap            className="w-3 h-3" /> },
}

function Badge({ type }: { type: string }) {
  const s = TYPE_CONFIG[type] ?? TYPE_CONFIG.component
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
      {s.icon}{type}
    </span>
  )
}

// ─── Node card ───────────────────────────────────────────────────────────────

function NodeCard({
  node,
  onClick,
  onDetail,
}: {
  node    : CognitiveNode
  onClick : () => void
  onDetail: () => void
}) {
  const hasChildren = node.children.length > 0

  return (
    <div
      className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-3 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer"
      onClick={hasChildren ? onClick : onDetail}
    >
      <div className="flex items-start justify-between gap-2">
        <Badge type={node.type} />
        {node.route && (
          <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded truncate max-w-[140px]">
            {node.route}
          </span>
        )}
      </div>

      <p className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">
        {node.intent}
      </p>

      <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">
        {node.description}
      </p>

      <div className="flex items-center justify-between pt-1 mt-auto border-t border-slate-50">
        {hasChildren ? (
          <button
            className="flex items-center gap-1 text-xs text-indigo-500 font-medium hover:text-indigo-700"
            onClick={e => { e.stopPropagation(); onClick() }}
          >
            <Layers className="w-3 h-3" />
            {node.children.length} enfant{node.children.length > 1 ? "s" : ""}
            <ChevronRight className="w-3 h-3" />
          </button>
        ) : <span />}
        <button
          className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2"
          onClick={e => { e.stopPropagation(); onDetail() }}
        >
          Détails
        </button>
      </div>
    </div>
  )
}

// ─── Detail overlay ──────────────────────────────────────────────────────────

function DetailOverlay({ node, onClose }: { node: CognitiveNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Badge type={node.type} />
              {node.route && (
                <code className="text-xs text-slate-400 font-mono">{node.route}</code>
              )}
            </div>
            <p className="text-base font-semibold text-slate-900 mt-1">{node.intent}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 flex flex-col gap-5">
          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Description</h3>
            <p className="text-sm text-slate-700 leading-relaxed">{node.description}</p>
          </section>

          {node.actionsPossible && node.actionsPossible.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Actions possibles</h3>
              <div className="flex flex-wrap gap-1.5">
                {node.actionsPossible.map(a => (
                  <span key={a} className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">{a}</span>
                ))}
              </div>
            </section>
          )}

          {node.examplePrompts && node.examplePrompts.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Exemples de questions</h3>
              <ul className="space-y-1">
                {node.examplePrompts.map((p, i) => (
                  <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                    <span className="text-indigo-400 mt-0.5">›</span> {p}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {node.prerequisites && node.prerequisites.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Prérequis</h3>
              <ul className="space-y-1">
                {node.prerequisites.map((p, i) => (
                  <li key={i} className="text-xs font-mono text-slate-500 bg-slate-50 px-2 py-1 rounded">{p}</li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Métadonnées</h3>
            <div className="bg-slate-50 rounded-lg px-3 py-3 flex flex-col gap-1.5 text-xs">
              <div className="flex gap-2"><span className="text-slate-400 w-28">id</span><span className="font-mono text-slate-700">{node.id}</span></div>
              <div className="flex gap-2"><span className="text-slate-400 w-28">type</span><span className="font-mono text-slate-700">{node.type}</span></div>
              {node.route      && <div className="flex gap-2"><span className="text-slate-400 w-28">route</span><span className="font-mono text-slate-700">{node.route}</span></div>}
              {node.urlPattern && <div className="flex gap-2"><span className="text-slate-400 w-28">urlPattern</span><span className="font-mono text-slate-700">{node.urlPattern}</span></div>}
              <div className="flex gap-2"><span className="text-slate-400 w-28">children</span><span className="font-mono text-slate-700">{node.children.length}</span></div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────

interface BreadcrumbItem { label: string; node: CognitiveNode | null }

function Breadcrumb({ items, onNavigate }: {
  items      : BreadcrumbItem[]
  onNavigate : (index: number) => void
}) {
  if (items.length <= 1) return null
  return (
    <nav className="flex items-center gap-1 text-sm text-slate-500 flex-wrap">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
          {i < items.length - 1 ? (
            <button onClick={() => onNavigate(i)} className="hover:text-indigo-600 hover:underline font-medium">
              {item.label}
            </button>
          ) : (
            <span className="text-slate-800 font-semibold">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function KnowledgePage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [treeVersion, setTreeVersion] = useState<TreeVersion | null>(null)
  const [tree, setTree]               = useState<CognitiveTree | null>(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [search, setSearch]           = useState("")
  const [detail, setDetail]           = useState<CognitiveNode | null>(null)
  const [stack, setStack]             = useState<BreadcrumbItem[]>([
    { label: "Knowledge Base", node: null },
  ])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      // 1. Get session token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError("Non authentifié"); setLoading(false); return }

      // 2. Fetch tree via API route (server reads Storage with service role)
      const res = await fetch(`/api/cognitive-tree/${projectId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (res.status === 404) {
        setError("Aucun arbre cognitif — lancez un scan de code source.")
        setLoading(false)
        return
      }
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({ error: res.statusText }))
        setError(`Erreur: ${msg}`)
        setLoading(false)
        return
      }

      const { version, tree: treeData } = await res.json()
      setTreeVersion(version)
      setTree(treeData)
      setStack([{ label: "Knowledge Base", node: treeData.root }])
      setLoading(false)
    }
    load()
  }, [projectId])

  // Current node in the stack
  const currentNode = stack[stack.length - 1].node

  // Visible children at current level
  const visibleNodes: CognitiveNode[] = useMemo(() => {
    if (!currentNode) return []
    return currentNode.children
  }, [currentNode])

  // Search filter (searches across intent + description + route + id)
  const filtered = useMemo(() => {
    if (!search.trim()) return visibleNodes
    const q = search.toLowerCase()
    return visibleNodes.filter(
      n =>
        n.intent.toLowerCase().includes(q)      ||
        n.description.toLowerCase().includes(q) ||
        n.id.toLowerCase().includes(q)          ||
        n.route?.toLowerCase().includes(q)
    )
  }, [visibleNodes, search])

  function drillInto(node: CognitiveNode) {
    setStack(s => [...s, { label: node.intent, node }])
    setSearch("")
  }

  function navigateTo(index: number) {
    setStack(s => s.slice(0, index + 1))
    setSearch("")
  }

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

  return (
    <>
      <div className="p-6 space-y-5 min-h-full bg-slate-50">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Knowledge Base</h1>
            {treeVersion && (
              <p className="text-sm text-slate-500 mt-0.5">
                {treeVersion.stats?.totalNodes?.toLocaleString() ?? "?"} nœuds ·{" "}
                {treeVersion.stats?.totalPages?.toLocaleString() ?? "?"} pages ·{" "}
                profondeur {treeVersion.stats?.maxDepth ?? "?"} ·{" "}
                <span className="font-mono text-xs">{treeVersion.framework}</span> ·{" "}
                v<span className="font-mono text-xs">{treeVersion.version?.replace("sha:", "")?.slice(0, 8)}</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm shadow-sm min-w-[220px]">
            <Search className="w-4 h-4 shrink-0 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="outline-none bg-transparent w-full text-slate-700 placeholder:text-slate-400"
            />
            {search && (
              <button onClick={() => setSearch("")}>
                <X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
              </button>
            )}
          </div>
        </div>

        {/* Tree metadata banner */}
        {treeVersion && stack.length === 1 && (
          <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-5 text-white shadow-md">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-4 h-4" />
              <span className="font-bold">Arbre cognitif</span>
              <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded font-mono">
                {treeVersion.framework}
              </span>
            </div>
            <p className="text-sm text-white/80">
              Généré le {new Date(treeVersion.timestamp).toLocaleString("fr-FR")} ·{" "}
              {treeVersion.stats?.totalNodes?.toLocaleString()} nœuds · profondeur {treeVersion.stats?.maxDepth}
            </p>
          </div>
        )}

        {/* Breadcrumb */}
        <Breadcrumb items={stack} onNavigate={navigateTo} />

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* Empty state */}
        {!error && filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            {!tree ? (
              <>
                <p className="text-slate-500 font-medium">Aucun arbre cognitif indexé</p>
                <p className="text-slate-400 text-sm mt-1">Lancez un scan de code source depuis l'onglet Source.</p>
              </>
            ) : search ? (
              <p className="text-slate-500 font-medium">Aucun résultat pour «{search}»</p>
            ) : (
              <p className="text-slate-500 font-medium">Ce nœud n'a pas d'enfants</p>
            )}
          </div>
        )}

        {/* Node grid */}
        {filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(node => (
              <NodeCard
                key={node.id}
                node={node}
                onClick={() => drillInto(node)}
                onDetail={() => setDetail(node)}
              />
            ))}
          </div>
        )}

        {filtered.length > 0 && (
          <p className="text-xs text-slate-400 text-center">
            {filtered.length} nœud{filtered.length > 1 ? "s" : ""} affiché{filtered.length > 1 ? "s" : ""}
            {search && ` · filtre "${search}"`}
          </p>
        )}
      </div>

      {detail && <DetailOverlay node={detail} onClose={() => setDetail(null)} />}
    </>
  )
}
