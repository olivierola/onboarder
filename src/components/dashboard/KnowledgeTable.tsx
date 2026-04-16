"use client"
import { useState } from "react"
import { Search, RefreshCw, Play, Filter, Zap, ChevronDown } from "lucide-react"
import { DbChunk, ChunkType } from "@/lib/types"

const typeColors: Record<ChunkType, string> = {
  element: "bg-blue-100 text-blue-700",
  page: "bg-violet-100 text-violet-700",
  flow: "bg-emerald-100 text-emerald-700",
}

interface Props {
  chunks: Array<{
    id: string
    chunk_type: string
    route: string
    label: string | null
    selector: string | null
    metadata: Record<string, unknown>
    updated_at: string
  }>
  totalCount: number
  uniqueRoutes: number
  avgConfidence: number | null
}

export function KnowledgeTable({ chunks, totalCount, uniqueRoutes, avgConfidence }: Props) {
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<"all" | ChunkType>("all")
  const [isCrawling, setIsCrawling] = useState(false)
  const [crawlMsg, setCrawlMsg] = useState<string | null>(null)

  const filtered = chunks.filter((c) => {
    const matchSearch =
      !search ||
      (c.label ?? "").toLowerCase().includes(search.toLowerCase()) ||
      c.route.includes(search)
    const matchType = typeFilter === "all" || c.chunk_type === typeFilter
    return matchSearch && matchType
  })

  const startCrawl = async () => {
    setIsCrawling(true)
    setCrawlMsg(null)
    try {
      const res = await fetch("/api/crawl-trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      setCrawlMsg(data.message ?? (data.error ? `Erreur : ${data.error}` : "Crawl lancé."))
    } catch {
      setCrawlMsg("Erreur réseau — réessayez.")
    } finally {
      setIsCrawling(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: "Chunks total",
            value: totalCount.toLocaleString(),
            sub: "3 types : element, page, flow",
          },
          {
            label: "Routes indexées",
            value: uniqueRoutes.toString(),
            sub: `Sur ${chunks.length > 0 ? chunks.length : "—"} chunks chargés`,
          },
          {
            label: "Confiance RAG moy.",
            value: avgConfidence != null ? avgConfidence.toFixed(2) : "—",
            sub: "Seuil recommandé : 0.72",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm"
          >
            <div className="text-2xl font-bold text-slate-900">{s.value}</div>
            <div className="text-sm font-medium text-slate-700 mt-0.5">{s.label}</div>
            <div className="text-xs text-slate-400">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Actions bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un chunk…"
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
          />
        </div>
        <div className="relative">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as "all" | ChunkType)}
            className="appearance-none pl-4 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 focus:outline-none focus:border-indigo-400 cursor-pointer"
          >
            <option value="all">Tous les types</option>
            <option value="element">element</option>
            <option value="page">page</option>
            <option value="flow">flow</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
        </div>
        <button
          onClick={startCrawl}
          disabled={isCrawling}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-70"
        >
          {isCrawling ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" /> Crawl en cours…
            </>
          ) : (
            <>
              <Play className="w-4 h-4" /> Lancer le crawl
            </>
          )}
        </button>
      </div>

      {crawlMsg && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-3 text-sm text-indigo-800">
          {crawlMsg}
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Zap className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="text-sm">
            {chunks.length === 0
              ? "Aucun chunk indexé. Lancez un crawl pour indexer votre application."
              : "Aucun résultat pour cette recherche."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                {["Type", "Label", "Route", "Selector", "Importance", "MAJ"].map((h, i) => (
                  <th
                    key={h}
                    className={`py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wide ${
                      i === 4 ? "text-center" : i === 5 ? "text-right" : "text-left"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const importance =
                  typeof c.metadata?.importance === "number"
                    ? c.metadata.importance
                    : 5
                const colorClass =
                  typeColors[(c.chunk_type as ChunkType)] ?? "bg-slate-100 text-slate-600"
                return (
                  <tr
                    key={c.id}
                    className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="py-3 px-5">
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${colorClass}`}>
                        {c.chunk_type}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-sm font-medium text-slate-800">
                      {c.label ?? "—"}
                    </td>
                    <td className="py-3 px-5 text-sm text-slate-500 font-mono">{c.route}</td>
                    <td className="py-3 px-5 text-xs text-slate-400 font-mono">
                      {c.selector ?? "—"}
                    </td>
                    <td className="py-3 px-5 text-center">
                      <div className="flex justify-center">
                        {Array.from({ length: 10 }, (_, i) => (
                          <div
                            key={i}
                            className={`w-1.5 h-1.5 rounded-full mx-0.5 ${
                              i < importance ? "bg-indigo-500" : "bg-slate-200"
                            }`}
                          />
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-5 text-right text-xs text-slate-400">
                      {new Date(c.updated_at).toLocaleDateString("fr-FR")}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length < totalCount && (
            <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400 text-center">
              Affichage de {filtered.length} sur {totalCount} chunks
            </div>
          )}
        </div>
      )}
    </div>
  )
}
