"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Zap, ArrowRight, Globe, FileText, Rocket } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({ name: "", url: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || !form.url.trim()) {
      setError("Le nom et l'URL sont requis.");
      return;
    }

    let url = form.url.trim();
    if (!url.startsWith("http")) url = "https://" + url;

    setSaving(true);
    const { data, error: err } = await supabase
      .from("onboarder_projects")
      .insert({
        name: form.name.trim(),
        url,
        description: form.description.trim() || null,
      })
      .select("id")
      .single();
    setSaving(false);

    if (err) { setError(err.message); return; }
    router.push(`/dashboard/${data.id}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-violet-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-10 justify-center">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-slate-900">Onboarder</span>
        </div>

        {step === 1 ? (
          /* Step 1: Welcome */
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8 text-center">
            <div className="text-5xl mb-4">🚀</div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Bienvenue sur Onboarder</h1>
            <p className="text-slate-500 mb-8 text-sm leading-relaxed">
              Onboarder indexe votre application SaaS et déploie un agent d'onboarding
              intelligent qui guide vos utilisateurs en temps réel.
            </p>

            <div className="grid grid-cols-3 gap-4 mb-8 text-left">
              {[
                { icon: Globe, label: "Indexation", desc: "Crawl automatique de votre UI" },
                { icon: Zap, label: "Agent IA", desc: "Réponses contextuelles en temps réel" },
                { icon: FileText, label: "Snippet", desc: "1 ligne de code à intégrer" },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="bg-slate-50 rounded-xl p-3 text-center">
                  <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                    <Icon className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="text-xs font-semibold text-slate-700">{label}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{desc}</div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
            >
              Créer mon premier projet <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-xs text-slate-400 mt-3">
              Vous avez déjà des projets ?{" "}
              <button onClick={() => router.push("/projects")} className="text-indigo-600 hover:underline">
                Voir mes projets
              </button>
            </p>
          </div>
        ) : (
          /* Step 2: Create project */
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
            <button
              onClick={() => setStep(1)}
              className="text-xs text-slate-400 hover:text-slate-600 mb-6 inline-flex items-center gap-1"
            >
              ← Retour
            </button>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                <Rocket className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-lg">Nouveau projet</h2>
                <p className="text-xs text-slate-500">Entrez les infos de votre application SaaS</p>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3 mb-5">
                {error}
              </div>
            )}

            <form onSubmit={createProject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Nom du projet *
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Mon SaaS CRM"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  URL de production *
                </label>
                <input
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://app.monsaas.com"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
                />
                <p className="text-xs text-slate-400 mt-1">
                  URL publique de votre application (pour le snippet).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Description <span className="font-normal text-slate-400">(optionnel)</span>
                </label>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="CRM pour PME, outil de facturation…"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 mt-2"
              >
                {saving ? (
                  <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Création…</>
                ) : (
                  <>Créer le projet <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
