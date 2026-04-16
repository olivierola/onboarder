"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { useRouter } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import {
  BookOpen, Search, AlertCircle, X, ChevronRight,
  Layers, FileText, Zap, MousePointer, Map as MapIcon,
  Globe, Component, ArrowRight,
} from "lucide-react"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Chunk {
  id           : string
  chunk_type   : string
  element_type : string | null
  route        : string
  route_title  : string | null
  element_id   : string | null
  parent_id    : string | null
  label        : string | null
  content      : string
  chunk_text   : string
  metadata     : Record<string, unknown>
  updated_at   : string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const TYPE_STYLE: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  page    : { bg: "bg-indigo-50",  text: "text-indigo-700",  icon: <FileText   className="w-3 h-3" /> },
  flow    : { bg: "bg-amber-50",   text: "text-amber-700",   icon: <Zap        className="w-3 h-3" /> },
  element : { bg: "bg-slate-50",   text: "text-slate-600",   icon: <MousePointer className="w-3 h-3" /> },
}

const PREVIEW_LEN = 160

function Badge({ type }: { type: string }) {
  const s = TYPE_STYLE[type] ?? TYPE_STYLE.element
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
      {s.icon}{type}
    </span>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-slate-400 shrink-0 w-24">{label}</span>
      <span className="text-slate-700 font-mono break-all">{value}</span>
    </div>
  )
}

// ─── Chunk card ──────────────────────────────────────────────────────────────

function ChunkCard({
  chunk,
  childCount,
  onClick,
  onDetail,
}: {
  chunk      : Chunk
  childCount : number
  onClick    : () => void
  onDetail   : () => void
}) {
  const preview = chunk.content.length > PREVIEW_LEN
    ? chunk.content.slice(0, PREVIEW_LEN) + "…"
    : chunk.content

  const hasChildren = childCount > 0

  return (
    <div
      className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-3 hover:shadow-md hover:border-slate-300 transition-all group cursor-pointer"
      onClick={hasChildren ? onClick : onDetail}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <Badge type={chunk.chunk_type} />
        {chunk.element_type && chunk.element_type !== chunk.chunk_type && (
          <span className="text-xs text-slate-400">{chunk.element_type}</span>
        )}
      </div>

      {/* Label */}
      <p className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">
        {chunk.label ?? chunk.element_id ?? chunk.route}
      </p>

      {/* Content preview */}
      <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">{preview}</p>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 mt-auto border-t border-slate-50">
        {hasChildren ? (
          <button
            className="flex items-center gap-1 text-xs text-indigo-500 font-medium hover:text-indigo-700"
            onClick={(e) => { e.stopPropagation(); onClick() }}
          >
            <Layers className="w-3 h-3" />
            {childCount} sous-nœud{childCount > 1 ? "s" : ""}
            <ChevronRight className="w-3 h-3" />
          </button>
        ) : (
          <span />
        )}
        <button
          className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2"
          onClick={(e) => { e.stopPropagation(); onDetail() }}
        >
          Détails
        </button>
      </div>
    </div>
  )
}

// ─── Detail overlay ──────────────────────────────────────────────────────────

function DetailOverlay({ chunk, onClose }: { chunk: Chunk; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Badge type={chunk.chunk_type} />
              {chunk.element_type && (
                <span className="text-xs text-slate-400">{chunk.element_type}</span>
              )}
            </div>
            <p className="text-base font-semibold text-slate-900 mt-1">
              {chunk.label ?? chunk.element_id ?? chunk.route}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {/* Content */}
          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Contenu</h3>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{chunk.content}</p>
          </section>

          {/* Chunk text */}
          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Chunk text (indexé)</h3>
            <p className="text-xs text-slate-500 font-mono bg-slate-50 rounded-lg px-3 py-2 leading-relaxed whitespace-pre-wrap">
              {chunk.chunk_text}
            </p>
          </section>

          {/* Meta */}
          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Métadonnées</h3>
            <div className="bg-slate-50 rounded-lg px-3 py-3 flex flex-col gap-1.5">
              <MetaRow label="route"       value={chunk.route} />
              {chunk.route_title  && <MetaRow label="route_title" value={chunk.route_title} />}
              {chunk.element_id   && <MetaRow label="element_id"  value={chunk.element_id} />}
              {chunk.parent_id    && <MetaRow label="parent_id"   value={chunk.parent_id} />}
              {chunk.element_type && <MetaRow label="element_type" value={chunk.element_type} />}
            </div>
          </section>

          {/* Metadata JSON (collapsible) */}
          {Object.keys(chunk.metadata).length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Metadata JSON</h3>
              <pre className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 overflow-x-auto">
                {JSON.stringify(chunk.metadata, null, 2)}
              </pre>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Breadcrumb ──────────────────────────────────────────────────────────────

interface BreadcrumbItem { label: string; elementId: string | null }

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
            <button
              onClick={() => onNavigate(i)}
              className="hover:text-indigo-600 hover:underline font-medium"
            >
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

// ─── Main page ───────────────────────────────────────────────────────────────

// ─── SaaS Map card ───────────────────────────────────────────────────────────

interface MapMeta {
  routes    : number
  sections  : number
  components: number
  framework : string
  generated : string
}

function SaasMapCard({ projectId, meta }: { projectId: string; meta: MapMeta | null }) {
  const router = useRouter()
  return (
    <button
      onClick={() => router.push(`/dashboard/${projectId}/map`)}
      className="group relative w-full text-left bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-5 shadow-md hover:shadow-lg hover:scale-[1.01] transition-all overflow-hidden"
    >
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-2 right-4 w-32 h-32 rounded-full bg-white/30 blur-2xl" />
        <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full bg-white/20 blur-xl" />
      </div>

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
              <MapIcon className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold text-base">SaaS Map</span>
            {meta?.framework && (
              <span className="text-[10px] bg-white/20 text-white px-1.5 py-0.5 rounded font-mono">{meta.framework}</span>
            )}
          </div>

          {meta ? (
            <div className="flex flex-wrap gap-3 text-xs text-white/80 mb-3">
              <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{meta.routes} routes</span>
              <span className="flex items-center gap-1"><Layers className="w-3 h-3" />{meta.sections} sections</span>
              <span className="flex items-center gap-1"><Component className="w-3 h-3" />{meta.components} composants</span>
            </div>
          ) : (
            <p className="text-xs text-white/60 mb-3">Aucune carte — lancez un scan de code source.</p>
          )}

          <p className="text-xs text-white/60 leading-relaxed">
            Arbre hiérarchique de toute l&apos;UI : routes → sections → composants avec sélecteurs, contexte métier et relations.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-white/15 group-hover:bg-white/25 text-white text-xs font-semibold px-3 py-1.5 rounded-xl shrink-0 transition-colors">
          Ouvrir
          <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
        </div>
      </div>

      {meta?.generated && (
        <p className="relative text-[10px] text-white/35 mt-3">
          Généré le {new Date(meta.generated).toLocaleString("fr-FR")}
        </p>
      )}
    </button>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function KnowledgePage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [chunks, setChunks]     = useState<Chunk[]>([])
  const [total, setTotal]       = useState<number | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [search, setSearch]     = useState("")
  const [detail, setDetail]     = useState<Chunk | null>(null)
  const [mapMeta, setMapMeta]   = useState<MapMeta | null>(null)

  // Breadcrumb stack: each entry = { label, elementId }
  // elementId === null → root (all routes)
  const [stack, setStack] = useState<BreadcrumbItem[]>([
    { label: "Knowledge Base", elementId: null },
  ])

  // Load map metadata in parallel
  useEffect(() => {
    supabase
      .from("onboarder_manifests")
      .select("tree, updated_at")
      .eq("project_id", projectId)
      .maybeSingle()
      .then(({ data }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const t = data?.tree as any
        if (t?.routes) {
          setMapMeta({
            routes    : t.routes?.length ?? 0,
            sections  : t.total_sections  ?? 0,
            components: t.total_components ?? 0,
            framework : t.app?.framework   ?? "",
            generated : t.generated_at     ?? "",
          })
        }
      })
  }, [projectId])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      const { data, count, error: err } = await supabase
        .from("onboarder_chunks")
        .select(
          "id, chunk_type, element_type, route, route_title, element_id, parent_id, label, content, chunk_text, metadata, updated_at",
          { count: "exact" }
        )
        .eq("project_id", projectId)
        .order("chunk_type", { ascending: true })
        .order("updated_at",  { ascending: false })
        .limit(1000)

      if (err) {
        setError(`Erreur Supabase: ${err.message}`)
      } else {
        setChunks(data ?? [])
        setTotal(count ?? 0)
      }
      setLoading(false)
    }
    load()
  }, [projectId])

  // Map elementId → children[]
  const childrenOf = useMemo(() => {
    const map = new Map<string | null, Chunk[]>()
    for (const c of chunks) {
      const key = c.parent_id ?? null
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(c)
    }
    return map
  }, [chunks])

  // Current level: elementId at top of stack
  const currentElementId = stack[stack.length - 1].elementId

  // Visible nodes at current level
  const visibleChunks = useMemo(() => {
    if (currentElementId === null) {
      // Root: show page chunks (one per route)
      const seen = new Set<string>()
      const pages: Chunk[] = []
      for (const c of chunks) {
        if (c.chunk_type === "page" && !seen.has(c.route)) {
          seen.add(c.route)
          pages.push(c)
        }
      }
      // Also show elements with no parent that aren't pages (orphans)
      const orphans = chunks.filter(
        c => c.chunk_type !== "page" && !c.parent_id
      )
      const result = [...pages, ...orphans]

      // Fallback: if no page chunks and no orphans, group by route using first chunk
      if (result.length === 0 && chunks.length > 0) {
        const routeSeen = new Set<string>()
        for (const c of chunks) {
          if (!routeSeen.has(c.route)) {
            routeSeen.add(c.route)
            result.push(c)
          }
        }
      }
      return result
    }
    return childrenOf.get(currentElementId) ?? []
  }, [currentElementId, chunks, childrenOf])

  // Search filter
  const filtered = useMemo(() => {
    if (!search.trim()) return visibleChunks
    const q = search.toLowerCase()
    return visibleChunks.filter(
      c =>
        c.label?.toLowerCase().includes(q) ||
        c.content.toLowerCase().includes(q) ||
        c.route.toLowerCase().includes(q) ||
        c.element_id?.toLowerCase().includes(q)
    )
  }, [visibleChunks, search])

  function drillInto(chunk: Chunk) {
    setStack(s => [...s, {
      label    : chunk.label ?? chunk.element_id ?? chunk.route,
      elementId: chunk.element_id,
    }])
    setSearch("")
  }

  function navigateTo(index: number) {
    setStack(s => s.slice(0, index + 1))
    setSearch("")
  }

  const routeCount = useMemo(
    () => new Set(chunks.map(c => c.route)).size,
    [chunks]
  )

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Chargement de la base de connaissance…</span>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="p-6 space-y-5 min-h-full bg-slate-50">

        {/* Top bar */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Knowledge Base</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {total ?? 0} chunks · {routeCount} routes
            </p>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-500 shadow-sm min-w-[220px]">
            <Search className="w-4 h-4 shrink-0" />
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

        {/* SaaS Map card — shown only at root level */}
        {stack.length === 1 && (
          <SaasMapCard projectId={projectId} meta={mapMeta} />
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
            {chunks.length === 0 ? (
              <>
                <p className="text-slate-500 font-medium">Aucun chunk indexé</p>
                <p className="text-slate-400 text-sm mt-1">Lancez un crawl depuis l&apos;onglet Indexation.</p>
              </>
            ) : (
              <p className="text-slate-500 font-medium">Aucun résultat pour &laquo;{search}&raquo;</p>
            )}
          </div>
        )}

        {/* Grid */}
        {filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(chunk => {
              const children = childrenOf.get(chunk.element_id ?? null) ?? []
              return (
                <ChunkCard
                  key={chunk.id}
                  chunk={chunk}
                  childCount={children.length}
                  onClick={() => drillInto(chunk)}
                  onDetail={() => setDetail(chunk)}
                />
              )
            })}
          </div>
        )}

        {/* Count footer */}
        {filtered.length > 0 && (
          <p className="text-xs text-slate-400 text-center">
            {filtered.length} nœud{filtered.length > 1 ? "s" : ""} affiché{filtered.length > 1 ? "s" : ""}
            {search && ` · filtre "${search}"`}
          </p>
        )}
      </div>

      {/* Detail overlay */}
      {detail && (
        <DetailOverlay chunk={detail} onClose={() => setDetail(null)} />
      )}
    </>
  )
}
