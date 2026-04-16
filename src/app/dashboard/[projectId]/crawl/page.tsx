"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import { Copy, Check, Globe, Layers, Clock, Terminal, RefreshCw } from "lucide-react"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Project {
  id: string; name: string; url: string
  status: "idle" | "crawling" | "ready" | "error"
  chunk_count: number; routes_crawled: string[]; last_crawled_at: string | null
  config?: { maxPages?: number } | null
}

function CopyButton({ text, label = "Copier" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="inline-flex items-center gap-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-2.5 py-1 rounded-lg transition-colors"
    >
      {copied ? <><Check className="w-3 h-3 text-emerald-400" /> Copié</> : <><Copy className="w-3 h-3" /> {label}</>}
    </button>
  )
}

export default function CrawlPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [polling, setPolling]  = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from("onboarder_projects")
      .select("id,name,url,status,chunk_count,routes_crawled,last_crawled_at,config")
      .eq("id", projectId).maybeSingle()
    if (data) setProject(data as Project)
  }, [projectId])

  useEffect(() => { load() }, [load])

  // Poll while crawling
  useEffect(() => {
    if (project?.status !== "crawling") { setPolling(false); return }
    setPolling(true)
    const t = setInterval(async () => {
      const { data } = await supabase.from("onboarder_projects")
        .select("status,chunk_count,routes_crawled,last_crawled_at")
        .eq("id", projectId).maybeSingle()
      if (data) {
        setProject((p) => p ? { ...p, ...data } : p)
        if (data.status !== "crawling") { setPolling(false); clearInterval(t) }
      }
    }, 3000)
    return () => clearInterval(t)
  }, [project?.status, projectId])

  const maxPages = project?.config?.maxPages ?? 30
  const targetUrl = project?.url ?? "http://localhost:3000"

  const command       = `cd knowledge-builder && PROJECT_ID=${projectId} TARGET_URL=${targetUrl} npm run crawl`
  const commandFilter = `cd knowledge-builder && PROJECT_ID=${projectId} TARGET_URL=${targetUrl} npm run crawl -- --routes /dashboard,/settings`

  const STATUS_COLOR: Record<string, string> = {
    idle:     "bg-gray-100 text-gray-500",
    crawling: "bg-yellow-100 text-yellow-700",
    ready:    "bg-emerald-100 text-emerald-700",
    error:    "bg-red-100 text-red-600",
  }
  const STATUS_LABEL: Record<string, string> = {
    idle: "En attente", crawling: "Crawl en cours…", ready: "Indexé", error: "Erreur",
  }
  const status = project?.status ?? "idle"

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Indexation</h1>
        <p className="text-sm text-slate-500 mt-1">
          Le crawler tourne en local avec Playwright — accès complet à votre app, même derrière une auth.
        </p>
      </div>

      {/* Status */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-3xl font-bold text-slate-900">{project?.chunk_count ?? 0}</div>
              <div className="text-xs text-slate-400 mt-0.5">chunks indexés</div>
            </div>
            <div className="h-8 w-px bg-slate-100" />
            <div>
              <div className="text-3xl font-bold text-slate-900">{project?.routes_crawled?.length ?? 0}</div>
              <div className="text-xs text-slate-400 mt-0.5">routes</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {polling && <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin" />}
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLOR[status]}`}>
              {STATUS_LABEL[status]}
            </span>
          </div>
        </div>
        {project?.last_crawled_at && (
          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            Dernier crawl : {new Date(project.last_crawled_at).toLocaleDateString("fr", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
        {polling && (
          <p className="text-xs text-indigo-500 mt-2 animate-pulse">
            Crawl en cours — mise à jour automatique…
          </p>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-800">Lancer le crawl</h2>
        </div>

        <div className="p-6 space-y-5">
          {/* Single command */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">
              Depuis la racine du projet, lancez :
            </p>
            <div className="relative">
              <pre className="bg-gray-950 text-gray-300 text-xs rounded-xl p-4 font-mono overflow-x-auto whitespace-pre">
                <span className="text-slate-500">$</span>{" "}
                <span className="text-slate-400">cd knowledge-builder &&</span>{" "}
                <span className="text-emerald-400">PROJECT_ID</span>=<span className="text-yellow-300">{projectId}</span>{" "}
                <span className="text-emerald-400">TARGET_URL</span>=<span className="text-yellow-300">{targetUrl}</span>{" "}
                <span className="text-slate-300">npm run crawl</span>
              </pre>
              <div className="absolute top-3 right-3">
                <CopyButton text={command} />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              <code className="bg-slate-100 px-1 rounded">SUPABASE_URL</code>,{" "}
              <code className="bg-slate-100 px-1 rounded">SUPABASE_ANON_KEY</code> et{" "}
              <code className="bg-slate-100 px-1 rounded">GEMINI_API_KEY</code> sont lus depuis{" "}
              <code className="bg-slate-100 px-1 rounded">knowledge-builder/.env</code>.
            </p>
          </div>

          {/* Partial crawl */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">
              Crawler seulement certaines routes :
            </p>
            <div className="relative">
              <pre className="bg-gray-950 text-gray-300 text-xs rounded-xl p-4 font-mono overflow-x-auto whitespace-pre">
                <span className="text-slate-500">$</span>{" "}
                <span className="text-slate-400">... npm run crawl --</span>{" "}
                <span className="text-emerald-400">--routes</span>{" "}
                <span className="text-yellow-300">/dashboard,/settings,/profile</span>
              </pre>
              <div className="absolute top-3 right-3">
                <CopyButton text={commandFilter} />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              Séparez les préfixes par des virgules. Les URLs dynamiques sont normalisées automatiquement
              — <code className="bg-slate-100 px-1 rounded">/dashboard/9d16…</code> est sauvegardé comme{" "}
              <code className="bg-slate-100 px-1 rounded">/dashboard/[id]</code>.
            </p>
          </div>

          {/* Auto-update note */}
          <div className="flex items-start gap-2 bg-slate-50 rounded-xl p-4">
            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">→</span>
            <div>
              <p className="text-sm font-medium text-slate-700">Le dashboard se met à jour automatiquement</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Les chunks sont uploadés dans Supabase avec ce <code className="bg-white px-1 rounded border border-slate-200">PROJECT_ID</code>.
                Cette page passe en <span className="text-emerald-600 font-medium">Indexé</span> dès la fin.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Routes */}
      {(project?.routes_crawled?.length ?? 0) > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <Globe className="w-4 h-4 text-slate-400" />
            Routes indexées ({project!.routes_crawled.length})
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {project!.routes_crawled.map((r) => (
              <span key={r} className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-mono">{r}</span>
            ))}
          </div>
        </div>
      )}

      {/* Capacités */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-slate-400" /> Ce que le crawler peut faire
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {[
            ["✅", "JavaScript rendu (React, Vue, Angular)"],
            ["✅", "Localhost et staging"],
            ["✅", "Routes dynamiques (/dashboard/[id])"],
            ["✅", "Auth (cookie, localStorage)"],
            ["✅", "SPAs sans SSR"],
            ["✅", "Jusqu'à " + maxPages + " pages configurables"],
          ].map(([icon, text]) => (
            <div key={text} className="flex items-center gap-2 text-xs text-slate-600">
              <span>{icon}</span> {text}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
