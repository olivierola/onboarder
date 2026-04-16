"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import {
  Github, GitBranch, RefreshCw, CheckCircle2, AlertCircle,
  Clock, FileCode2, Layers, Webhook, Trash2, Play,
  Upload, ChevronRight, Plus, X, Globe, Link2,
} from "lucide-react"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ─── Types ────────────────────────────────────────────────────────────────────

type Provider = "github" | "gitlab" | "bitbucket" | "azure" | "upload"

interface Source {
  id              : string
  provider        : Provider
  label           : string
  provider_config : Record<string, string>
  status          : "idle" | "scanning" | "ready" | "error"
  last_scanned_at : string | null
  last_commit_sha : string | null
  files_scanned   : number
  framework       : string | null
  error_message   : string | null
  webhook_id      : string | null
}

// ─── Provider metadata ────────────────────────────────────────────────────────

const PROVIDERS: Record<Provider, {
  label   : string
  icon    : React.ReactNode
  color   : string
  bgColor : string
  fields  : Array<{ key: string; label: string; placeholder: string; type?: string; optional?: boolean }>
}> = {
  github: {
    label  : "GitHub",
    icon   : <Github className="w-5 h-5" />,
    color  : "text-white",
    bgColor: "bg-slate-900",
    fields : [
      { key: "owner",  label: "Owner",    placeholder: "monentreprise" },
      { key: "repo",   label: "Repo",     placeholder: "mon-saas" },
      { key: "branch", label: "Branch",   placeholder: "main" },
      { key: "token",  label: "Access token", placeholder: "ghp_… (repo privé)", type: "password", optional: true },
    ],
  },
  gitlab: {
    label  : "GitLab",
    icon   : (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 01-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 014.82 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.49h8.1l2.44-7.51a.42.42 0 01.11-.18.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.51 1.22 3.78a.84.84 0 01-.3.94z"/>
      </svg>
    ),
    color  : "text-white",
    bgColor: "bg-orange-600",
    fields : [
      { key: "project_id", label: "Project ID or path", placeholder: "namespace/project or 12345" },
      { key: "branch",     label: "Branch",             placeholder: "main" },
      { key: "token",      label: "Personal Access Token", placeholder: "glpat-…", type: "password" },
      { key: "host",       label: "GitLab host",        placeholder: "gitlab.com", optional: true },
    ],
  },
  bitbucket: {
    label  : "Bitbucket",
    icon   : (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M.778 1.213a.768.768 0 00-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 00.77-.646l3.27-20.03a.768.768 0 00-.768-.891L.778 1.213zM14.52 15.53H9.522L8.17 8.466h7.561l-1.211 7.064z"/>
      </svg>
    ),
    color  : "text-white",
    bgColor: "bg-blue-600",
    fields : [
      { key: "workspace",    label: "Workspace",    placeholder: "mon-workspace" },
      { key: "repo",         label: "Repo slug",    placeholder: "mon-saas" },
      { key: "branch",       label: "Branch",       placeholder: "main" },
      { key: "username",     label: "Username",     placeholder: "mon-username" },
      { key: "app_password", label: "App Password", placeholder: "••••••••", type: "password" },
    ],
  },
  azure: {
    label  : "Azure DevOps",
    icon   : (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M0 18.605l2.962-.677V5.601L0 4.711zM22.908 0l-8.955 3.675v16.625l8.955-2.453V0zM8.324 13.801L3.203 12.5V7.39l5.121 3.456zM8.324 4.061L1.201 9.82l1.414 1.06 5.71-3.49z"/>
      </svg>
    ),
    color  : "text-white",
    bgColor: "bg-blue-700",
    fields : [
      { key: "organization", label: "Organisation",  placeholder: "mon-org" },
      { key: "project",      label: "Projet",        placeholder: "mon-projet" },
      { key: "repo",         label: "Repo",          placeholder: "mon-repo" },
      { key: "branch",       label: "Branch",        placeholder: "main" },
      { key: "token",        label: "Personal Access Token", placeholder: "••••••••", type: "password" },
    ],
  },
  upload: {
    label  : "Upload (ZIP)",
    icon   : <Upload className="w-5 h-5" />,
    color  : "text-white",
    bgColor: "bg-violet-600",
    fields : [],
  },
}

const STATUS_STYLE = {
  idle    : { label: "Non scanné",    color: "bg-gray-100 text-gray-500",       dot: "bg-gray-400" },
  scanning: { label: "Scan en cours", color: "bg-yellow-100 text-yellow-700",   dot: "bg-yellow-500 animate-pulse" },
  ready   : { label: "Prêt",          color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  error   : { label: "Erreur",        color: "bg-red-100 text-red-600",         dot: "bg-red-500" },
}

// ─── Component ────────────────────────────────────────────────────────────────

// ─── Crawl status type ────────────────────────────────────────────────────────
type CrawlStatus = "idle" | "crawling" | "ready" | "error"

const CRAWL_STATUS_STYLE: Record<CrawlStatus, { label: string; color: string; dot: string }> = {
  idle    : { label: "Non crawlé",    color: "bg-gray-100 text-gray-500",       dot: "bg-gray-400" },
  crawling: { label: "Crawl en cours", color: "bg-yellow-100 text-yellow-700",  dot: "bg-yellow-500 animate-pulse" },
  ready   : { label: "Prêt",          color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  error   : { label: "Erreur",        color: "bg-red-100 text-red-600",         dot: "bg-red-500" },
}

export default function SourcePage() {
  const { projectId } = useParams<{ projectId: string }>()

  const [sources, setSources]           = useState<Source[]>([])
  const [loading, setLoading]           = useState(true)
  const [showAdd, setShowAdd]           = useState(false)
  const [selectedProvider, setSelected] = useState<Provider>("github")
  const [form, setForm]                 = useState<Record<string, string>>({})
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState("")
  const [scanningId, setScanningId]     = useState<string | null>(null)
  // Track failed scan attempts per source — max 5
  const [failedAttempts, setFailedAttempts] = useState<Record<string, number>>({})
  const MAX_RETRIES = 5

  // ── Crawl URL state ──────────────────────────────────────────────────────────
  const [crawlUrl, setCrawlUrl]         = useState("")
  const [crawlStatus, setCrawlStatus]   = useState<CrawlStatus>("idle")
  const [crawlError, setCrawlError]     = useState<string | null>(null)
  const [crawlStats, setCrawlStats]     = useState<{ pages: number; chunks: number; routes: string[] } | null>(null)
  const [crawling, setCrawling]         = useState(false)

  const load = async () => {
    const { data } = await supabase
      .from("onboarder_sources")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true })
    setSources((data ?? []) as Source[])
    setLoading(false)
  }

  // Load project URL + crawl status on mount
  useEffect(() => {
    supabase
      .from("onboarder_projects")
      .select("url, status, error_message, routes_crawled, chunk_count")
      .eq("id", projectId)
      .single()
      .then(({ data }) => {
        if (!data) return
        if (data.url) setCrawlUrl(data.url)
        // Only reflect crawl status if it's from a crawl operation
        if (data.status === "crawling") setCrawlStatus("crawling")
        else if (data.status === "ready" && data.routes_crawled?.length) {
          setCrawlStatus("ready")
          setCrawlStats({ pages: data.routes_crawled.length, chunks: data.chunk_count ?? 0, routes: data.routes_crawled })
        } else if (data.status === "error" && data.error_message) {
          setCrawlStatus("error")
          setCrawlError(data.error_message)
        }
      })
  }, [projectId])

  // Poll when crawling
  useEffect(() => {
    if (crawlStatus !== "crawling") return
    const t = setInterval(async () => {
      const { data } = await supabase
        .from("onboarder_projects")
        .select("status, error_message, routes_crawled, chunk_count")
        .eq("id", projectId)
        .single()
      if (!data) return
      if (data.status === "ready") {
        setCrawlStatus("ready")
        setCrawlStats({ pages: data.routes_crawled?.length ?? 0, chunks: data.chunk_count ?? 0, routes: data.routes_crawled ?? [] })
        clearInterval(t)
      } else if (data.status === "error") {
        setCrawlStatus("error")
        setCrawlError(data.error_message ?? "Erreur inconnue")
        clearInterval(t)
      }
    }, 3000)
    return () => clearInterval(t)
  }, [crawlStatus, projectId])

  const triggerCrawl = async () => {
    if (!crawlUrl.trim()) return
    setCrawling(true)
    setCrawlError(null)
    setCrawlStatus("crawling")
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/crawl-project`, {
        method : "POST",
        headers: {
          "Content-Type" : "application/json",
          "apikey"       : ANON_KEY,
          "Authorization": `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ projectId, crawlUrl: crawlUrl.trim() }),
      })
      const result = await res.json()
      if (!res.ok) {
        setCrawlStatus("error")
        setCrawlError(result.error ?? "Erreur lors du crawl")
      }
      // Status will be updated by the polling effect
    } catch (e) {
      setCrawlStatus("error")
      setCrawlError(String(e))
    } finally {
      setCrawling(false)
    }
  }

  useEffect(() => { load() }, [projectId])

  // Poll scanning sources — stops after MAX_POLL_ATTEMPTS or when scan is done/error
  useEffect(() => {
    const scanning = sources.filter(s => s.status === "scanning")
    if (!scanning.length) return

    const MAX_POLL_ATTEMPTS = 100 // 100 × 3s = 5 minutes max
    let pollCount = 0

    const t = setInterval(async () => {
      pollCount++

      if (pollCount >= MAX_POLL_ATTEMPTS) {
        // Timed out — mark all still-scanning sources as error
        clearInterval(t)
        setSources(prev => prev.map(s =>
          s.status === "scanning"
            ? { ...s, status: "error", error_message: "Délai dépassé — le scan ne répond plus." }
            : s
        ))
        return
      }

      const { data } = await supabase
        .from("onboarder_sources")
        .select("id, status, files_scanned, last_scanned_at, error_message, last_commit_sha")
        .eq("project_id", projectId)

      if (data) {
        setSources(prev => prev.map(s => {
          const update = (data as Source[]).find(d => d.id === s.id)
          return update ? { ...s, ...update } : s
        }))
        const stillScanning = (data as Source[]).some(d => d.status === "scanning")
        if (!stillScanning) clearInterval(t)
      }
    }, 3000)

    return () => clearInterval(t)
  }, [sources.map(s => s.status).join(",")])

  const handleProviderSelect = (p: Provider) => {
    setSelected(p)
    setForm({ branch: "main" })
    setError("")
  }

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    const meta = PROVIDERS[selectedProvider]

    // Validate required fields
    for (const field of meta.fields) {
      if (!field.optional && !form[field.key]?.trim()) {
        setError(`Le champ "${field.label}" est requis`)
        return
      }
    }

    const providerConfig: Record<string, string> = {}
    for (const field of meta.fields) {
      if (form[field.key]?.trim()) {
        providerConfig[field.key] = form[field.key].trim()
      }
    }

    // Auto-parse GitHub URL if user pasted a full URL
    // e.g. https://github.com/owner/repo.git → owner=owner, repo=repo
    if (selectedProvider === "github") {
      const raw = providerConfig.owner ?? ""
      const urlMatch = raw.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/)
      if (urlMatch) {
        providerConfig.owner = urlMatch[1]
        providerConfig.repo  = urlMatch[2]
      } else {
        // Also handle if user pasted URL in the repo field
        const repoRaw = providerConfig.repo ?? ""
        const repoMatch = repoRaw.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/)
        if (repoMatch) {
          providerConfig.owner = repoMatch[1]
          providerConfig.repo  = repoMatch[2]
        } else {
          // Strip any accidental .git suffix
          providerConfig.repo = (providerConfig.repo ?? "").replace(/\.git$/, "")
        }
      }
    }

    // Build a human-readable label
    let label = ""
    if (selectedProvider === "github")     label = `${providerConfig.owner}/${providerConfig.repo}`
    else if (selectedProvider === "gitlab") label = providerConfig.project_id
    else if (selectedProvider === "bitbucket") label = `${providerConfig.workspace}/${providerConfig.repo}`
    else if (selectedProvider === "azure") label = `${providerConfig.organization}/${providerConfig.project}/${providerConfig.repo}`
    else if (selectedProvider === "upload") label = `upload-${Date.now()}`

    setSaving(true)
    const { data, error: err } = await supabase
      .from("onboarder_sources")
      .insert({
        project_id     : projectId,
        provider       : selectedProvider,
        label,
        provider_config: providerConfig,
        status         : "idle",
      })
      .select("*")
      .single()

    setSaving(false)
    if (err) { setError(err.message); return }

    setSources(prev => [...prev, data as Source])
    setShowAdd(false)
    setForm({})
  }

  const triggerScan = async (source: Source, incremental = false) => {
    const attempts = failedAttempts[source.id] ?? 0
    if (attempts >= MAX_RETRIES) return // should not happen (button is disabled), but guard anyway

    setScanningId(source.id)
    setSources(prev => prev.map(s => s.id === source.id ? { ...s, status: "scanning", error_message: null } : s))

    let failed = false
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/code-scan`, {
        method : "POST",
        headers: {
          "Content-Type" : "application/json",
          "apikey"       : ANON_KEY,
          "Authorization": `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ source_id: source.id, incremental }),
      })
      const result = await res.json()
      if (!res.ok) {
        failed = true
        setError(result.error ?? "Erreur lors du scan")
      }
    } catch (e) {
      failed = true
      setError(String(e))
    }

    if (failed) {
      const newCount = attempts + 1
      setFailedAttempts(prev => ({ ...prev, [source.id]: newCount }))

      const remaining = MAX_RETRIES - newCount
      setSources(prev => prev.map(s =>
        s.id === source.id
          ? {
              ...s,
              status: "error",
              error_message: remaining > 0
                ? `Échec du scan (tentative ${newCount}/${MAX_RETRIES}). ${remaining} essai${remaining > 1 ? "s" : ""} restant${remaining > 1 ? "s" : ""}.`
                : `Scan abandonné après ${MAX_RETRIES} tentatives échouées.`,
            }
          : s
      ))
    } else {
      // Reset fail counter on success
      setFailedAttempts(prev => ({ ...prev, [source.id]: 0 }))
    }

    setScanningId(null)
    await load()
  }

  const deleteSource = async (source: Source) => {
    if (!confirm(`Supprimer la source "${source.label}" et tous ses chunks ?`)) return
    await supabase.from("onboarder_sources").delete().eq("id", source.id)
    setSources(prev => prev.filter(s => s.id !== source.id))
  }

  if (loading) return <div className="p-8 text-slate-400 text-sm">Chargement…</div>

  const meta = PROVIDERS[selectedProvider]

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sources de code</h1>
          <p className="text-sm text-slate-500 mt-1">
            Connectez vos dépôts — Groq analyse le code et construit la knowledge base automatiquement.
          </p>
        </div>
        {!showAdd && (
          <button
            onClick={() => { setShowAdd(true); setSelected("github"); setForm({ branch: "main" }); setError("") }}
            className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm px-4 py-2 rounded-xl font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Ajouter une source
          </button>
        )}
      </div>

      {/* ── Existing sources ──────────────────────────────────────────────── */}
      {sources.map(source => (
        <SourceCard
          key={source.id}
          source={source}
          scanning={scanningId === source.id}
          supabaseUrl={SUPABASE_URL}
          failedAttempts={failedAttempts[source.id] ?? 0}
          maxRetries={MAX_RETRIES}
          onScan={incremental => triggerScan(source, incremental)}
          onDelete={() => deleteSource(source)}
          onResetRetries={() => setFailedAttempts(prev => ({ ...prev, [source.id]: 0 }))}
        />
      ))}

      {sources.length === 0 && !showAdd && (
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-10 text-center">
          <FileCode2 className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Aucune source connectée</p>
          <p className="text-xs text-slate-400 mt-1">Ajoutez GitHub, GitLab, Bitbucket, Azure ou uploadez un ZIP</p>
        </div>
      )}

      {/* ── Add source form ────────────────────────────────────────────────── */}
      {showAdd && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Ajouter une source</h2>
            <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Provider picker */}
          <div className="grid grid-cols-5 gap-2">
            {(Object.keys(PROVIDERS) as Provider[]).map(p => {
              const pm = PROVIDERS[p]
              const active = selectedProvider === p
              return (
                <button
                  key={p}
                  onClick={() => handleProviderSelect(p)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all ${
                    active
                      ? "border-indigo-400 bg-indigo-50 text-indigo-700 shadow-sm"
                      : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${pm.bgColor} ${pm.color}`}>
                    {pm.icon}
                  </span>
                  {pm.label}
                </button>
              )
            })}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl px-4 py-3 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
            </div>
          )}

          {/* Upload placeholder */}
          {selectedProvider === "upload" ? (
            <div className="bg-violet-50 rounded-xl p-4 text-xs text-violet-700 text-center space-y-2">
              <Upload className="w-6 h-6 mx-auto text-violet-400" />
              <p className="font-medium">Upload de fichier ZIP</p>
              <p className="text-violet-500">Fonctionnalité à venir — glissez-déposez une archive ZIP de votre projet</p>
            </div>
          ) : (
            <form onSubmit={handleConnect} className="space-y-4">
              <div className={`grid gap-3 ${meta.fields.length > 3 ? "grid-cols-2" : "grid-cols-1"}`}>
                {meta.fields.map(field => (
                  <div key={field.key}>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      {field.label}
                      {field.optional && <span className="text-slate-400 font-normal ml-1">(optionnel)</span>}
                    </label>
                    <input
                      type={field.type ?? "text"}
                      value={form[field.key] ?? ""}
                      onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                ))}
              </div>

              <button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 w-full justify-center"
              >
                {saving
                  ? <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Connexion…</>
                  : <><span className={`w-5 h-5 rounded flex items-center justify-center ${meta.bgColor} ${meta.color}`}>{meta.icon}</span> Connecter {meta.label}</>
                }
              </button>
            </form>
          )}
        </div>
      )}

      {/* ── Crawl URL section ─────────────────────────────────────────────── */}
      <CrawlUrlCard
        crawlUrl={crawlUrl}
        onUrlChange={setCrawlUrl}
        status={crawlStatus}
        error={crawlError}
        stats={crawlStats}
        crawling={crawling}
        onCrawl={triggerCrawl}
      />

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-slate-400" /> Comment ça fonctionne
        </h2>
        <div className="space-y-2.5">
          {[
            ["1", "Groq analyse chaque fichier source (pages, composants, API routes)"],
            ["2", "Il extrait : routes, éléments interactifs, formulaires, modales, appels API"],
            ["3", "Les données sont vectorisées et stockées dans la knowledge base"],
            ["4", "À chaque push, seuls les fichiers modifiés sont re-scannés"],
          ].map(([n, text]) => (
            <div key={n} className="flex items-start gap-3 text-xs text-slate-600">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold shrink-0 text-[10px]">
                {n}
              </span>
              {text}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Crawl URL card ───────────────────────────────────────────────────────────

function CrawlUrlCard({
  crawlUrl, onUrlChange, status, error, stats, crawling, onCrawl,
}: {
  crawlUrl    : string
  onUrlChange : (v: string) => void
  status      : CrawlStatus
  error       : string | null
  stats       : { pages: number; chunks: number; routes: string[] } | null
  crawling    : boolean
  onCrawl     : () => void
}) {
  const st = CRAWL_STATUS_STYLE[status]

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center text-white">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-slate-900 text-sm">Crawl de l'URL du SaaS</div>
            <div className="text-xs text-slate-400 mt-0.5">Analyse les pages HTML rendues du SaaS en production</div>
          </div>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 ${st.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
          {st.label}
        </span>
      </div>

      {/* URL input + button */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="url"
            value={crawlUrl}
            onChange={e => onUrlChange(e.target.value)}
            placeholder="https://app.monSaaS.com"
            className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400"
          />
        </div>
        <button
          onClick={onCrawl}
          disabled={crawling || status === "crawling" || !crawlUrl.trim()}
          className="flex items-center gap-1.5 bg-sky-600 text-white text-xs px-4 py-2.5 rounded-xl font-medium hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          {crawling || status === "crawling"
            ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Crawl en cours…</>
            : <><Play className="w-3.5 h-3.5" /> Lancer le crawl</>
          }
        </button>
      </div>

      {/* Crawling pulse */}
      {status === "crawling" && (
        <div className="flex items-center gap-2 text-xs text-sky-500 animate-pulse">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          Crawl BFS en cours — analyse avec Groq et vectorisation…
        </div>
      )}

      {/* Error */}
      {status === "error" && error && (
        <div className="flex items-start gap-2 bg-red-50 rounded-xl p-3 text-xs text-red-700">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Stats on success */}
      {status === "ready" && stats && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100">
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900">{stats.pages}</div>
              <div className="text-xs text-slate-400 flex items-center justify-center gap-1">
                <Globe className="w-3 h-3" /> pages crawlées
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900">{stats.chunks}</div>
              <div className="text-xs text-slate-400">chunks vectorisés</div>
            </div>
            <div className="text-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mt-1" />
              <div className="text-xs text-slate-400 mt-0.5">knowledge base prête</div>
            </div>
          </div>
          {stats.routes.length > 0 && (
            <details className="group">
              <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600 flex items-center gap-1.5">
                <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform" />
                Routes crawlées ({stats.routes.length})
              </summary>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {stats.routes.map(r => (
                  <span key={r} className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                    {r}
                  </span>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Info note */}
      <div className="bg-sky-50 rounded-xl px-4 py-3 text-xs text-sky-700">
        <span className="font-semibold">Note :</span> le crawl fonctionne sur les pages à rendu serveur (SSR/SSG).
        Les apps full-SPA sans SSR retourneront peu de contenu.
        Complément idéal du scan de dépôt.
      </div>
    </div>
  )
}

// ─── Source card ──────────────────────────────────────────────────────────────

function SourceCard({
  source,
  scanning,
  supabaseUrl,
  failedAttempts,
  maxRetries,
  onScan,
  onDelete,
  onResetRetries,
}: {
  source          : Source
  scanning        : boolean
  supabaseUrl     : string
  failedAttempts  : number
  maxRetries      : number
  onScan          : (incremental: boolean) => void
  onDelete        : () => void
  onResetRetries  : () => void
}) {
  const meta       = PROVIDERS[source.provider]
  const status     = STATUS_STYLE[source.status] ?? STATUS_STYLE.idle
  const maxed      = failedAttempts >= maxRetries
  const scanDisabled = source.status === "scanning" || scanning || maxed

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${meta.bgColor} ${meta.color}`}>
            {meta.icon}
          </div>
          <div>
            <div className="font-semibold text-slate-900 text-sm">{source.label}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-slate-400 font-medium">{meta.label}</span>
              {source.provider_config.branch && (
                <>
                  <span className="text-slate-300">·</span>
                  <GitBranch className="w-3 h-3 text-slate-400" />
                  <span className="text-xs text-slate-400">{source.provider_config.branch}</span>
                </>
              )}
              {source.framework && (
                <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-mono">
                  {source.framework}
                </span>
              )}
            </div>
          </div>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 ${status.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100">
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-900">{source.files_scanned}</div>
          <div className="text-xs text-slate-400 flex items-center justify-center gap-1">
            <FileCode2 className="w-3 h-3" /> fichiers scannés
          </div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-900">
            {source.last_scanned_at
              ? new Date(source.last_scanned_at).toLocaleDateString("fr", { day: "numeric", month: "short" })
              : "—"}
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-center gap-1">
            <Clock className="w-3 h-3" /> dernier scan
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs font-mono text-slate-700 mt-1 truncate">
            {source.last_commit_sha?.slice(0, 7) ?? "—"}
          </div>
          <div className="text-xs text-slate-400">dernier commit</div>
        </div>
      </div>

      {source.status === "scanning" && (
        <div className="flex items-center gap-2 text-xs text-indigo-500 animate-pulse">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          Scan en cours — analyse avec Groq…
        </div>
      )}

      {source.error_message && (
        <div className="flex items-start gap-2 bg-red-50 rounded-xl p-3 text-xs text-red-700">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {source.error_message}
        </div>
      )}

      {/* Max retries banner */}
      {maxed && (
        <div className="flex items-center justify-between gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-orange-700">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            Scan désactivé après {maxRetries} tentatives échouées.
          </div>
          <button
            onClick={onResetRetries}
            className="text-xs font-semibold text-orange-700 hover:text-orange-900 underline underline-offset-2 shrink-0"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Attempts indicator (visible when at least 1 failure and not maxed) */}
      {failedAttempts > 0 && !maxed && (
        <div className="flex items-center gap-1.5 text-xs text-orange-600">
          {Array.from({ length: maxRetries }).map((_, i) => (
            <span
              key={i}
              className={`w-2 h-2 rounded-full ${i < failedAttempts ? "bg-orange-400" : "bg-slate-200"}`}
            />
          ))}
          <span className="ml-1">{failedAttempts}/{maxRetries} tentatives échouées</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-slate-100">
        <button
          onClick={() => onScan(false)}
          disabled={scanDisabled}
          className="flex items-center gap-1.5 bg-indigo-600 text-white text-xs px-3 py-2 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Play className="w-3.5 h-3.5" /> Scan complet
        </button>
        {source.last_scanned_at && (
          <button
            onClick={() => onScan(true)}
            disabled={scanDisabled}
            className="flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs px-3 py-2 rounded-xl font-medium hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Incrémental
          </button>
        )}
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 text-slate-400 hover:text-red-500 text-xs px-3 py-2 rounded-xl hover:bg-red-50 transition-colors ml-auto"
        >
          <Trash2 className="w-3.5 h-3.5" /> Supprimer
        </button>
      </div>

      {/* Webhook info for git providers */}
      {source.provider !== "upload" && (
        <details className="group">
          <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600 flex items-center gap-1.5 pt-1">
            <Webhook className="w-3.5 h-3.5" />
            Webhook (re-scan automatique)
            <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform" />
          </summary>
          <div className="mt-3 bg-gray-950 rounded-xl p-3 text-xs font-mono text-gray-300">
            <div className="text-slate-500">Payload URL :</div>
            <div className="text-emerald-400 mt-1 break-all">
              {supabaseUrl}/functions/v1/code-webhook
            </div>
            <div className="text-slate-500 mt-2">Content type :</div>
            <div className="text-yellow-300">application/json</div>
            <div className="text-slate-500 mt-2">Event :</div>
            <div className="text-yellow-300">
              {source.provider === "github"    && "push"}
              {source.provider === "gitlab"    && "Push events"}
              {source.provider === "bitbucket" && "repo:push"}
              {source.provider === "azure"     && "git.push"}
            </div>
          </div>
        </details>
      )}
    </div>
  )
}
