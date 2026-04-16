"use client";

import { useEffect, useState } from "react";
import { useRouter }           from "next/navigation";
import { Building2, Plus, Zap, LogOut, Loader2, X, ArrowRight } from "lucide-react";
import { cn }                  from "@/lib/utils";
import { createOrgAction, getUserOrgsAction } from "@/app/actions/orgs";
import { createClient }        from "@/lib/supabase";

interface Org { id: string; name: string; slug: string; created_at: string; role?: string }

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const ROLE_CFG: Record<string, { label: string; cls: string }> = {
  owner:  { label: "Propriétaire", cls: "bg-violet-100 text-violet-700" },
  admin:  { label: "Admin",        cls: "bg-indigo-100 text-indigo-600" },
  member: { label: "Membre",       cls: "bg-slate-100 text-slate-500"   },
};

export default function OrgsPage() {
  const router = useRouter();

  const [orgs,      setOrgs]      = useState<Org[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form,      setForm]      = useState({ name: "", slug: "" });
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => { loadOrgs(); }, []);

  async function loadOrgs() {
    const result = await getUserOrgsAction();
    if (result.error || !result.data) { router.push("/login"); return; }
    setOrgs(result.data as Org[]);
    setUserEmail(result.email ?? "");
    setLoading(false);
  }

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) { setError("Le nom est requis"); return; }
    const slug = form.slug.trim() || slugify(form.name);
    setSaving(true);
    const result = await createOrgAction(form.name.trim(), slug);
    setSaving(false);
    if (result.error) { setError(result.error); return; }
    selectOrg(result.data!.id);
  }

  function selectOrg(orgId: string) {
    document.cookie = `onboarder_org_id=${orgId};path=/;max-age=${60 * 60 * 24 * 30}`;
    router.push("/projects");
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
  }

  const roleFor = (org: Org) => ROLE_CFG[org.role ?? "member"] ?? ROLE_CFG.member;

  return (
    <div className="min-h-screen bg-[#f5f5f8]">

      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-slate-200/70">
        <div className="max-w-4xl mx-auto px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-gradient-to-br from-violet-600 to-indigo-700 rounded-lg flex items-center justify-center shadow-sm">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-slate-800 text-sm">Onboarder</span>
          </div>
          <div className="flex items-center gap-3">
            {userEmail && <span className="text-xs text-slate-400 hidden sm:block">{userEmail}</span>}
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
          <h1 className="text-2xl font-bold text-slate-900">Vos organisations</h1>
          <p className="text-slate-500 text-sm mt-1.5">Sélectionnez une organisation pour accéder à ses projets.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">

            {/* Org cards */}
            {orgs.map(org => {
              const role = roleFor(org);
              return (
                <button
                  key={org.id}
                  onClick={() => selectOrg(org.id)}
                  className="group bg-white border border-slate-200/80 rounded-2xl p-6 text-left flex flex-col gap-5 hover:shadow-xl hover:shadow-violet-100/60 hover:border-violet-300 hover:-translate-y-1 transition-all duration-200"
                >
                  {/* Icon + role */}
                  <div className="flex items-start justify-between">
                    <div className="w-13 h-13 p-3 bg-gradient-to-br from-violet-50 to-indigo-100 rounded-2xl ring-1 ring-violet-100 group-hover:ring-violet-200 transition-all">
                      <Building2 className="w-6 h-6 text-violet-600" />
                    </div>
                    <span className={cn("text-[11px] font-semibold px-2.5 py-1 rounded-full", role.cls)}>
                      {role.label}
                    </span>
                  </div>

                  {/* Name + slug */}
                  <div className="flex-1">
                    <p className="text-base font-semibold text-slate-900 group-hover:text-violet-700 transition-colors leading-snug">
                      {org.name}
                    </p>
                    <p className="text-xs text-slate-400 font-mono mt-1">{org.slug}</p>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <p className="text-[11px] text-slate-400">
                      {new Date(org.created_at).toLocaleDateString("fr", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-violet-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              );
            })}

            {/* Add card */}
            <button
              onClick={() => { setShowModal(true); setError(""); setForm({ name: "", slug: "" }); }}
              className="group border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-4 text-center hover:border-violet-400 hover:bg-violet-50/50 transition-all duration-200 min-h-[200px]"
            >
              <div className="w-13 h-13 p-3 bg-slate-100 group-hover:bg-violet-100 rounded-2xl transition-colors">
                <Plus className="w-6 h-6 text-slate-400 group-hover:text-violet-600 transition-colors" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500 group-hover:text-violet-700 transition-colors">
                  Nouvelle organisation
                </p>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">Créer un espace de travail</p>
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
              <h2 className="text-base font-bold text-slate-900">Nouvelle organisation</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-2.5 mb-4">
                {error}
              </div>
            )}

            <form onSubmit={createOrg} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Nom *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: slugify(e.target.value) }))}
                  placeholder="Acme Inc."
                  autoFocus
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Slug</label>
                <input
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))}
                  placeholder="acme-inc"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-50 font-mono transition-colors"
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
