"use client";

import { useEffect, useState } from "react";
import { createClient }        from "@/lib/supabase";
import { useRouter }           from "next/navigation";
import Link                    from "next/link";
import {
  Zap, Plus, Globe, Layers, Clock, Trash2, ArrowRight,
  Building2, LogOut, SwitchCamera, Loader2, X,
} from "lucide-react";

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
  org_id: string | null;
}

interface OrgInfo { id: string; name: string; slug: string }

const STATUS_BADGE: Record<string, { label: string; color: string; dot: string; ring: string }> = {
  idle:     { label: "En attente",     color: "bg-slate-100 text-slate-500",     dot: "bg-slate-300",                     ring: "ring-slate-200" },
  crawling: { label: "Crawl en cours", color: "bg-amber-50 text-amber-700",      dot: "bg-amber-400 animate-pulse",       ring: "ring-amber-200" },
  ready:    { label: "Prêt",           color: "bg-emerald-50 text-emerald-700",  dot: "bg-emerald-500",                   ring: "ring-emerald-200" },
  error:    { label: "Erreur",         color: "bg-red-50 text-red-600",          dot: "bg-red-500",                       ring: "ring-red-200" },
};

function getActiveOrgId(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)onboarder_org_id=([^;]+)/);
  return m ? m[1] : null;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return "aujourd'hui";
  if (d === 1) return "hier";
  if (d < 30)  return `il y a ${d}j`;
  return new Date(dateStr).toLocaleDateString("fr", { day: "numeric", month: "short" });
}

export default function ProjectsPage() {
  const router   = useRouter();
  const supabase = createClient();

  const [orgInfo,   setOrgInfo]   = useState<OrgInfo | null>(null);
  const [projects,  setProjects]  = useState<Project[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form,      setForm]      = useState({ name: "", url: "", description: "" });
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const orgId = getActiveOrgId();
    if (!orgId) { router.push("/orgs"); return; }

    const { data: { user } } = await supabase.auth.getUser();
    setUserEmail(user?.email ?? "");

    const { data: org } = await supabase
      .from("onboarder_organizations").select("id, name, slug").eq("id", orgId).single();
    setOrgInfo(org);

    const { data } = await supabase
      .from("onboarder_projects").select("*").eq("org_id", orgId).order("created_at", { ascending: false });
    setProjects((data as Project[]) ?? []);
    setLoading(false);
  }

  async function addProject(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || !form.url.trim()) { setError("Nom et URL requis"); return; }

    const orgId = getActiveOrgId();
    let url = form.url.trim();
    if (!url.startsWith("http")) url = "https://" + url;

    setSaving(true);
    const { data, error: err } = await supabase
      .from("onboarder_projects")
      .insert({ name: form.name.trim(), url, description: form.description.trim() || null, org_id: orgId })
      .select("id").single();
    setSaving(false);

    if (err) { setError(err.message); return; }
    setForm({ name: "", url: "", description: "" });
    setShowModal(false);
    router.push(`/dashboard/${data.id}`);
  }

  async function deleteProject(e: React.MouseEvent, id: string) {
    e.stopPropagation(); e.preventDefault();
    if (!confirm("Supprimer ce projet et tous ses chunks ?")) return;
    await supabase.from("onboarder_projects").delete().eq("id", id);
    await loadAll();
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-[#f5f5f8]">

      {/* Top bar */}
      <div className="border-b border-slate-200/70 bg-white/90 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center shadow-sm">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-slate-800 text-sm">Onboarder</span>
            {orgInfo && (
              <>
                <span className="text-slate-200">/</span>
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-sm font-medium text-slate-600">{orgInfo.name}</span>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {userEmail && <span className="text-xs text-slate-400 hidden sm:block mr-1">{userEmail}</span>}
            <Link
              href="/orgs"
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              <SwitchCamera className="w-3.5 h-3.5" /> Changer d&apos;org
            </Link>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" /> Déconnexion
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-12">
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-slate-900">Projets</h1>
          <p className="text-slate-500 text-sm mt-1.5">
            Chaque projet est une application SaaS avec son propre agent et ses propres chunks.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">

            {/* Project cards */}
            {projects.map(p => {
              const badge = STATUS_BADGE[p.status] ?? STATUS_BADGE.idle;
              return (
                <Link
                  key={p.id}
                  href={`/dashboard/${p.id}`}
                  className="group bg-white border border-slate-200/80 rounded-2xl p-6 flex flex-col gap-5 hover:shadow-xl hover:shadow-indigo-100/60 hover:border-indigo-300 hover:-translate-y-1 transition-all duration-200 relative"
                >
                  {/* Delete */}
                  <button
                    onClick={e => deleteProject(e, p.id)}
                    className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Status badge */}
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${badge.dot}`} />
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${badge.color}`}>
                      {badge.label}
                    </span>
                  </div>

                  {/* Name + desc + url */}
                  <div className="flex-1 space-y-1.5">
                    <p className="text-base font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug pr-5">
                      {p.name}
                    </p>
                    {p.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{p.description}</p>
                    )}
                    <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1 truncate pt-0.5">
                      <Globe className="w-3 h-3 shrink-0" />
                      {p.url.replace(/^https?:\/\//, "")}
                    </p>
                  </div>

                  {/* Stats + arrow */}
                  <div className="flex items-center gap-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Layers className="w-3.5 h-3.5 text-slate-300" />
                      <span className="font-semibold text-slate-700">{p.chunk_count}</span>
                      <span className="text-slate-400">chunks</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">{p.routes_crawled?.length ?? 0}</span>
                      <span className="text-slate-400 ml-1">routes</span>
                    </div>
                    {p.last_crawled_at && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <Clock className="w-3 h-3" />
                        {timeAgo(p.last_crawled_at)}
                      </div>
                    )}
                    <ArrowRight className="w-4 h-4 text-slate-200 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all ml-auto" />
                  </div>
                </Link>
              );
            })}

            {/* Add card */}
            <button
              onClick={() => { setShowModal(true); setError(""); setForm({ name: "", url: "", description: "" }); }}
              className="group border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-4 text-center hover:border-indigo-400 hover:bg-indigo-50/50 transition-all duration-200 min-h-[220px]"
            >
              <div className="w-13 h-13 p-3 bg-slate-100 group-hover:bg-indigo-100 rounded-2xl transition-colors">
                <Plus className="w-6 h-6 text-slate-400 group-hover:text-indigo-600 transition-colors" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500 group-hover:text-indigo-700 transition-colors">
                  Nouveau projet
                </p>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">Indexer une nouvelle application</p>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl shadow-slate-200/80 p-7 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-bold text-slate-900">Nouveau projet</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-2.5 mb-4">
                {error}
              </div>
            )}

            <form onSubmit={addProject} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Nom *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Mon SaaS CRM"
                  autoFocus
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">URL de production *</label>
                <input
                  value={form.url}
                  onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  placeholder="https://app.monsaas.com"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Description <span className="text-slate-400 font-normal">(optionnel)</span>
                </label>
                <input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="CRM pour PME, outil de facturation…"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-colors"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 text-sm font-medium border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 btn-dark py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                >
                  {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Création…</> : "Créer →"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
