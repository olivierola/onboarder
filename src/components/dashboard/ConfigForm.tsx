"use client"
import { useState, useTransition } from "react"
import { Save, Palette, Bot, Zap, Shield } from "lucide-react"
import { saveConfig, ConfigFormData } from "@/app/dashboard/config/actions"

interface Props {
  initialConfig: ConfigFormData
}

export function ConfigForm({ initialConfig }: Props) {
  const [config, setConfig] = useState<ConfigFormData>(initialConfig)
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const [isPending, startTransition] = useTransition()

  const update = <K extends keyof ConfigFormData>(key: K, value: ConfigFormData[K]) =>
    setConfig((p) => ({ ...p, [key]: value }))

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveConfig(config)
      if (result.ok) {
        setStatus("saved")
        setTimeout(() => setStatus("idle"), 2500)
      } else {
        setStatus("error")
        setErrorMsg(result.error ?? "Erreur inconnue")
        setTimeout(() => setStatus("idle"), 4000)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Application */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2">
          <Zap className="w-4 h-4 text-indigo-500" /> Application
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Nom de l&apos;app
            </label>
            <input
              value={config.appName}
              onChange={(e) => update("appName", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              URL de l&apos;app
            </label>
            <input
              value={config.appUrl}
              onChange={(e) => update("appUrl", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Langue</label>
            <select
              value={config.locale}
              onChange={(e) => update("locale", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 bg-white"
            >
              <option value="fr">🇫🇷 Français</option>
              <option value="en">🇬🇧 English</option>
              <option value="es">🇪🇸 Español</option>
              <option value="de">🇩🇪 Deutsch</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Ton de l&apos;agent
            </label>
            <select
              value={config.tone}
              onChange={(e) => update("tone", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 bg-white"
            >
              <option value="friendly">😊 Amical</option>
              <option value="professional">💼 Professionnel</option>
              <option value="concise">⚡ Concis</option>
              <option value="playful">🎉 Ludique</option>
            </select>
          </div>
        </div>
      </section>

      {/* Branding */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2">
          <Palette className="w-4 h-4 text-violet-500" /> Branding
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Nom de l&apos;agent
            </label>
            <input
              value={config.agentName}
              onChange={(e) => update("agentName", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Avatar (emoji)
            </label>
            <input
              value={config.agentEmoji}
              onChange={(e) => update("agentEmoji", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Couleur primaire
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={config.primaryColor}
                onChange={(e) => update("primaryColor", e.target.value)}
                className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5"
              />
              <input
                value={config.primaryColor}
                onChange={(e) => update("primaryColor", e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-indigo-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Position widget
            </label>
            <select
              value={config.widgetPosition}
              onChange={(e) => update("widgetPosition", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 bg-white"
            >
              <option value="bottom-right">Bas droite ↘</option>
              <option value="bottom-left">Bas gauche ↙</option>
            </select>
          </div>
        </div>

        {/* Live preview */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
          <p className="text-xs text-slate-500 mb-3">Aperçu du launcher</p>
          <div className="flex items-end gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${config.primaryColor}, ${config.primaryColor}cc)`,
              }}
            >
              {config.agentEmoji}
            </div>
            <div
              className="px-4 py-2 rounded-2xl text-white text-sm shadow"
              style={{ background: config.primaryColor }}
            >
              Bonjour ! Comment puis-je vous aider ? 👋
            </div>
          </div>
        </div>
      </section>

      {/* Behavior */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2">
          <Bot className="w-4 h-4 text-emerald-500" /> Comportement proactif
        </h2>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Délai avant intervention proactive :{" "}
            <strong className="text-indigo-600">{config.proactivityDelay}s</strong>
          </label>
          <input
            type="range"
            min={30}
            max={300}
            step={10}
            value={config.proactivityDelay}
            onChange={(e) => update("proactivityDelay", Number(e.target.value))}
            className="w-full accent-indigo-500"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>30s — agressif</span>
            <span>300s — discret</span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Seuil confiance RAG minimum :{" "}
            <strong className="text-indigo-600">{config.minConfidence}</strong>
          </label>
          <input
            type="range"
            min={0.5}
            max={0.9}
            step={0.01}
            value={config.minConfidence}
            onChange={(e) => update("minConfidence", Number(e.target.value))}
            className="w-full accent-indigo-500"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>0.50 — tolérant</span>
            <span>0.90 — strict</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            En dessous de ce seuil, l&apos;agent préfixe sa réponse par &quot;Je ne suis pas certain —&quot;
          </p>
        </div>
      </section>

      {/* Privacy */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2">
          <Shield className="w-4 h-4 text-slate-500" /> Confidentialité & Rétention
        </h2>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Rétention des conversations
          </label>
          <select
            value={config.retentionDays}
            onChange={(e) => update("retentionDays", Number(e.target.value))}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 bg-white"
          >
            <option value={7}>7 jours</option>
            <option value={30}>30 jours (recommandé)</option>
            <option value={90}>90 jours</option>
          </select>
        </div>
        <div className="bg-slate-50 rounded-xl p-4 text-xs text-slate-500 space-y-1 border border-slate-100">
          <p>✓ Aucun PII envoyé à Groq ou Gemini — les userId sont hashés</p>
          <p>✓ RLS Supabase — isolation totale entre workspaces</p>
          <p>✓ Chiffrement AES-256 au repos — région EU (Frankfurt)</p>
          <p>✓ Snippet CSP-safe — pas d&apos;eval(), pas de dépendances tierces</p>
        </div>
      </section>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200 disabled:opacity-70"
        >
          <Save className="w-4 h-4" />
          {isPending ? "Enregistrement…" : status === "saved" ? "Enregistré ✓" : "Enregistrer la configuration"}
        </button>
        {status === "error" && (
          <p className="text-sm text-red-600">{errorMsg}</p>
        )}
      </div>
    </div>
  )
}
