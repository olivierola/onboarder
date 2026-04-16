"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { ArrowLeft, Play, RefreshCw, Copy, Check, Globe, Layers, Clock, X } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

interface Project {
  id: string;
  name: string;
  url: string;
  description: string | null;
  status: "idle" | "crawling" | "ready" | "error";
  chunk_count: number;
  routes_crawled: string[];
  last_crawled_at: string | null;
  created_at: string;
  config: {
    tone?: string;
    locale?: string;
    agentName?: string;
    agentEmoji?: string;
    proactiveDelayMs?: number;
    maxPages?: number;
  } | null;
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  idle:     { label: "En attente",       color: "bg-gray-100 text-gray-600" },
  crawling: { label: "Crawl en cours…",  color: "bg-yellow-100 text-yellow-700 animate-pulse" },
  ready:    { label: "Prêt",             color: "bg-green-100 text-green-700" },
  error:    { label: "Erreur",           color: "bg-red-100 text-red-600" },
};

const isLocalUrl = (url: string) =>
  /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i.test(url);

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [project,      setProject]      = useState<Project | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [copied,       setCopied]       = useState(false);
  const [error,        setError]        = useState("");
  const [showCrawlDlg, setShowCrawlDlg] = useState(false);
  const [crawlUrl,     setCrawlUrl]     = useState("");
  const [crawling,     setCrawling]     = useState(false);
  const [crawlLogs,    setCrawlLogs]    = useState<string[]>([]);
  const [config, setConfig] = useState({
    tone: "friendly",
    locale: "fr",
    agentName: "Assistant",
    agentEmoji: "🤖",
    proactiveDelayMs: 90000,
    maxPages: 30,
  });

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("onboarder_projects")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (data) {
      setProject(data as Project);
      setCrawlUrl(data.url ?? "");
      if (data.config) setConfig((prev) => ({ ...prev, ...data.config }));
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Poll status while crawling
  useEffect(() => {
    if (project?.status !== "crawling") return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("onboarder_projects")
        .select("status, chunk_count, routes_crawled, last_crawled_at")
        .eq("id", id)
        .maybeSingle();
      if (data) {
        setProject((prev) => prev ? { ...prev, ...data } : prev);
        if (data.status !== "crawling") clearInterval(interval);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [project?.status, id]);

  const openCrawlDialog = () => {
    setError("");
    setCrawlUrl(project?.url ?? "");
    setShowCrawlDlg(true);
  };

  const startCrawl = async () => {
    setError("");
    let url = crawlUrl.trim();
    if (!url) { setError("Entrez une URL."); return; }
    if (!url.startsWith("http")) url = "https://" + url;

    setCrawling(true);
    setShowCrawlDlg(false);

    try {
      // Local URLs → Next.js API route (runs on your machine, can reach localhost)
      // Remote URLs → Supabase edge function
      const endpoint = isLocalUrl(url)
        ? "/api/crawl-local"
        : `${SUPABASE_URL}/functions/v1/crawl-project`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id, crawlUrl: url }),
      });

      const data = await res.json().catch(() => ({}));

      if (data.logs?.length) setCrawlLogs(data.logs);

      if (!res.ok) {
        const msg = data.details?.length
          ? `${data.error} — ${data.details[0]}`
          : (data.error ?? `Erreur HTTP ${res.status}`);
        setError(msg);
      } else {
        setCrawlLogs([]);
        setProject((prev) => prev ? { ...prev, status: "crawling" } : prev);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setCrawling(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    await supabase.from("onboarder_projects").update({ config }).eq("id", id);
    setSaving(false);
  };

  const snippet = project
    ? `<script\n  src="https://cdn.yourdomain.com/onboarder.min.js"\n  data-project-id="${project.id}"\n  data-supabase-url="${SUPABASE_URL}"\n  async\n></script>`
    : "";

  const copySnippet = () => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Chargement…</div>;
  if (!project) return (
    <div className="p-8 text-center">
      <p className="text-gray-500">Projet introuvable.</p>
      <Link href="/dashboard/projects" className="text-indigo-600 text-sm mt-2 inline-block">← Retour</Link>
    </div>
  );

  const badge = STATUS_BADGE[project.status] ?? STATUS_BADGE.idle;

  return (
    <>
      {/* Crawl URL dialog */}
      {showCrawlDlg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-gray-900 text-lg">Lancer le crawl</h3>
              <button
                onClick={() => setShowCrawlDlg(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Entrez l'URL à crawler. Vous pouvez utiliser une URL locale pour tester en développement.
            </p>

            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

            <label className="block text-xs font-medium text-gray-600 mb-1.5">URL à crawler</label>
            <input
              value={crawlUrl}
              onChange={(e) => setCrawlUrl(e.target.value)}
              placeholder="https://app.monsaas.com ou http://localhost:3000"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 mb-1"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") startCrawl(); }}
            />
            <p className={`text-xs mb-5 rounded-lg px-3 py-2 ${
              isLocalUrl(crawlUrl)
                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                : "bg-gray-50 text-gray-400 border border-gray-100"
            }`}>
              {isLocalUrl(crawlUrl)
                ? "✓ URL locale détectée — le crawl tournera sur votre machine (pas besoin de ngrok)."
                : "URL distante — le crawl tournera sur les serveurs Supabase."}
            </p>

            <div className="flex gap-3">
              <button
                onClick={startCrawl}
                disabled={crawling}
                className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" /> Démarrer le crawl
              </button>
              <button
                onClick={() => setShowCrawlDlg(false)}
                className="px-4 py-2.5 text-sm text-gray-500 rounded-xl hover:bg-gray-100"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-8 max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600 mb-4">
            <ArrowLeft className="w-3.5 h-3.5" /> Tous les projets
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
              <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" /> {project.url}
              </p>
              {project.description && <p className="text-sm text-gray-500 mt-1">{project.description}</p>}
            </div>
            <span className={`text-xs px-3 py-1 rounded-full font-medium shrink-0 ${badge.color}`}>
              {badge.label}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{project.chunk_count}</div>
            <div className="text-xs text-gray-400 mt-0.5 flex items-center justify-center gap-1">
              <Layers className="w-3 h-3" /> Chunks indexés
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{project.routes_crawled.length}</div>
            <div className="text-xs text-gray-400 mt-0.5 flex items-center justify-center gap-1">
              <Globe className="w-3 h-3" /> Routes crawlées
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <div className="text-sm font-semibold text-gray-700">
              {project.last_crawled_at
                ? new Date(project.last_crawled_at).toLocaleDateString("fr", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                : "—"}
            </div>
            <div className="text-xs text-gray-400 mt-0.5 flex items-center justify-center gap-1">
              <Clock className="w-3 h-3" /> Dernier crawl
            </div>
          </div>
        </div>

        {/* Crawl section */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Indexation</h2>
          <p className="text-sm text-gray-500 mb-4">
            Le crawler visite votre application et indexe le contenu UI pour alimenter l'agent.
          </p>
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <div className="flex gap-3 items-center">
            <button
              onClick={openCrawlDialog}
              disabled={crawling || project.status === "crawling"}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {project.status === "crawling" || crawling
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Crawl en cours…</>
                : <><Play className="w-4 h-4" /> {project.status === "ready" ? "Re-crawler" : "Lancer le crawl"}</>
              }
            </button>
            {project.status === "crawling" && (
              <span className="text-xs text-gray-400 animate-pulse">Mise à jour automatique…</span>
            )}
          </div>

          {crawlLogs.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-gray-600 mb-1.5">Logs du dernier crawl :</p>
              <pre className="bg-gray-950 text-gray-300 text-xs rounded-xl p-4 overflow-auto max-h-48 leading-relaxed font-mono whitespace-pre-wrap">
                {crawlLogs.join("\n")}
              </pre>
            </div>
          )}

          {project.routes_crawled.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-medium text-gray-600 mb-2">Routes indexées :</p>
              <div className="flex flex-wrap gap-1.5">
                {project.routes_crawled.map((r) => (
                  <span key={r} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-mono">
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Agent config */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Configuration de l'agent</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nom de l'agent</label>
              <input
                value={config.agentName}
                onChange={(e) => setConfig({ ...config, agentName: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Emoji</label>
              <input
                value={config.agentEmoji}
                onChange={(e) => setConfig({ ...config, agentEmoji: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ton</label>
              <select
                value={config.tone}
                onChange={(e) => setConfig({ ...config, tone: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 bg-white"
              >
                <option value="friendly">Friendly</option>
                <option value="professional">Professional</option>
                <option value="concise">Concis</option>
                <option value="fun">Fun</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Langue</label>
              <select
                value={config.locale}
                onChange={(e) => setConfig({ ...config, locale: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 bg-white"
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="de">Deutsch</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Déclenchement proactif (secondes)</label>
              <input
                type="number"
                value={config.proactiveDelayMs / 1000}
                onChange={(e) => setConfig({ ...config, proactiveDelayMs: Number(e.target.value) * 1000 })}
                min={10} max={600}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Pages max à crawler</label>
              <input
                type="number"
                value={config.maxPages}
                onChange={(e) => setConfig({ ...config, maxPages: Number(e.target.value) })}
                min={5} max={200}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
              />
            </div>
          </div>
          <button
            onClick={saveConfig}
            disabled={saving}
            className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Sauvegarde…" : "Sauvegarder la configuration"}
          </button>
        </div>

        {/* Snippet */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-900">Code d'intégration</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Collez ce snippet dans le <code className="bg-gray-100 px-1 rounded">&lt;head&gt;</code> de votre application.
              </p>
            </div>
            <button
              onClick={copySnippet}
              className="inline-flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              {copied ? <><Check className="w-3.5 h-3.5 text-green-600" /> Copié !</> : <><Copy className="w-3.5 h-3.5" /> Copier</>}
            </button>
          </div>
          <pre className="bg-gray-950 text-green-400 text-xs rounded-xl p-4 overflow-x-auto leading-relaxed font-mono whitespace-pre">
            {snippet}
          </pre>
          <p className="text-xs text-gray-400 mt-3">
            L'ID de projet <code className="bg-gray-100 px-1 rounded">{project.id}</code> est unique à cette application.
          </p>
        </div>
      </div>
    </>
  );
}
