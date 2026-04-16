"use client"

import { useParams } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import {
  KeyRound, Plus, Copy, Check, Trash2, ShieldCheck,
  ShieldOff, Clock, AlertTriangle, X, ChevronDown, ChevronUp,
  ExternalLink,
} from "lucide-react"
import { createClient } from "@/lib/supabase"

// ─── Types ────────────────────────────────────────────────────────────────────

interface AccessToken {
  id            : string
  label         : string
  token_prefix  : string
  scope         : string
  allowed_origins: string[]
  is_active     : boolean
  last_used_at  : string | null
  created_at    : string
  revoked_at    : string | null
}

interface NewTokenResult {
  token       : string
  tokenPrefix : string
  id          : string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ONBOARDER_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

function fmtDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
  })
}

function timeAgo(iso: string | null) {
  if (!iso) return "jamais"
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `il y a ${mins} min`
  const h = Math.floor(mins / 60)
  if (h < 24) return `il y a ${h}h`
  return fmtDate(iso)
}

// ─── Create modal ─────────────────────────────────────────────────────────────

function CreateModal({
  projectId,
  onboarderUrl,
  onCreated,
  onClose,
}: {
  projectId   : string
  onboarderUrl: string
  onCreated   : (result: NewTokenResult) => void
  onClose     : () => void
}) {
  const [label,   setLabel]   = useState("Production")
  const [origins, setOrigins] = useState("")
  const [loading, setLoading] = useState(false)
  const [err,     setErr]     = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setErr(null)
    try {
      const allowedOrigins = origins
        .split(/[\s,]+/)
        .map(s => s.trim())
        .filter(Boolean)
      const res = await fetch(`${onboarderUrl}/functions/v1/create-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          projectId,
          label,
          allowedOrigins,
        }),
      })
      const data = await res.json() as NewTokenResult & { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Erreur lors de la création")
      onCreated(data)
    } catch (e) {
      setErr(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center">
              <KeyRound className="w-4 h-4 text-indigo-600" />
            </div>
            <h2 className="font-semibold text-slate-900">Nouveau token d'accès</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Nom du token
            </label>
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="ex : Production, Staging, Demo…"
              required
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-colors"
            />
            <p className="text-xs text-slate-400 mt-1.5">Un nom lisible pour identifier ce token dans la liste.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Origines autorisées <span className="text-slate-400 font-normal">(optionnel)</span>
            </label>
            <input
              value={origins}
              onChange={e => setOrigins(e.target.value)}
              placeholder="https://app.monproduit.com, https://staging.monproduit.com"
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-colors"
            />
            <p className="text-xs text-slate-400 mt-1.5">Laissez vide pour autoriser toutes les origines. Séparez par des virgules.</p>
          </div>

          {err && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-100">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {err}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 font-medium hover:bg-slate-50 transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {loading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3V4a10 10 0 100 10h-2a8 8 0 01-8-8z"/>
                </svg>
              ) : <KeyRound className="w-4 h-4" />}
              Générer
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Token revealed modal ─────────────────────────────────────────────────────

function TokenRevealModal({
  result,
  onClose,
}: {
  result  : NewTokenResult
  onClose : () => void
}) {
  const [copied, setCopied] = useState(false)
  const [showEnv, setShowEnv] = useState(false)

  function copy() {
    navigator.clipboard.writeText(result.token)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const envSnippet = `NEXT_PUBLIC_ONBOARDER_TOKEN=${result.token}\nNEXT_PUBLIC_ONBOARDER_URL=${ONBOARDER_URL}`
  const [copiedEnv, setCopiedEnv] = useState(false)
  function copyEnv() {
    navigator.clipboard.writeText(envSnippet)
    setCopiedEnv(true)
    setTimeout(() => setCopiedEnv(false), 2500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 px-6 pt-6 pb-5 border-b border-emerald-100">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">Token généré !</h2>
              <p className="text-xs text-slate-500">Copiez-le maintenant — il ne sera plus affiché.</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Warning */}
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800">
              Ce token est affiché <strong>une seule fois</strong>.
              Nous ne le stockons pas en clair. Sauvegardez-le dans vos variables d'environnement.
            </p>
          </div>

          {/* Token value */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Token d'accès
            </label>
            <div className="flex items-center gap-2 bg-slate-950 rounded-xl px-4 py-3">
              <code className="flex-1 text-emerald-400 text-sm font-mono break-all leading-relaxed">
                {result.token}
              </code>
              <button onClick={copy}
                className="shrink-0 flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1.5 rounded-lg transition-colors font-medium">
                {copied
                  ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copié</>
                  : <><Copy className="w-3.5 h-3.5" /> Copier</>}
              </button>
            </div>
          </div>

          {/* Env snippet toggle */}
          <div>
            <button
              onClick={() => setShowEnv(v => !v)}
              className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
            >
              {showEnv ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Voir le snippet .env
            </button>

            {showEnv && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-slate-500 font-medium">.env.local</span>
                  <button onClick={copyEnv}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors">
                    {copiedEnv ? <><Check className="w-3 h-3 text-emerald-500" /> Copié</> : <><Copy className="w-3 h-3" /> Copier</>}
                  </button>
                </div>
                <pre className="bg-slate-950 text-slate-300 text-xs rounded-xl p-4 font-mono overflow-x-auto leading-relaxed">
{`NEXT_PUBLIC_ONBOARDER_TOKEN=${result.token}
NEXT_PUBLIC_ONBOARDER_URL=${ONBOARDER_URL}`}
                </pre>
                <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
                  <ExternalLink className="w-3 h-3" />
                  Puis ajoutez <code className="bg-slate-100 px-1 rounded">{"<OnboarderAgent token={...} />"}</code> dans votre layout.
                </p>
              </div>
            )}
          </div>

          <button onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors">
            J'ai sauvegardé le token
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Revoke confirm ───────────────────────────────────────────────────────────

function RevokeConfirm({
  token       : t,
  onboarderUrl,
  onRevoked,
  onClose,
}: {
  token        : AccessToken
  onboarderUrl : string
  onRevoked    : (id: string) => void
  onClose      : () => void
}) {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function confirm() {
    setLoading(true); setErr(null)
    try {
      const res = await fetch(`${onboarderUrl}/functions/v1/create-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke", tokenId: t.id }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Erreur")
      onRevoked(t.id)
    } catch (e) {
      setErr(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
            <ShieldOff className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Révoquer ce token ?</h3>
            <p className="text-xs text-slate-500 mt-0.5">{t.label} · {t.token_prefix}</p>
          </div>
        </div>
        <p className="text-sm text-slate-600">
          Toute application utilisant ce token sera immédiatement déconnectée. Cette action est <strong>irréversible</strong>.
        </p>
        {err && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{err}</p>
        )}
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 font-medium hover:bg-slate-50 transition-colors">
            Annuler
          </button>
          <button onClick={confirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            {loading
              ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3V4a10 10 0 100 10h-2a8 8 0 01-8-8z"/></svg>
              : <Trash2 className="w-4 h-4" />}
            Révoquer
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Token row ────────────────────────────────────────────────────────────────

function TokenRow({
  token: t,
  onRevoke,
}: {
  token    : AccessToken
  onRevoke : (t: AccessToken) => void
}) {
  const [copied, setCopied] = useState(false)

  function copyPrefix() {
    navigator.clipboard.writeText(t.token_prefix.replace("…", ""))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
      t.is_active
        ? "bg-white border-slate-200 hover:border-slate-300"
        : "bg-slate-50 border-slate-100 opacity-60"
    }`}>
      {/* Status dot */}
      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
        t.is_active ? "bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,.2)]" : "bg-slate-300"
      }`} />

      {/* Label + prefix */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-800">{t.label}</span>
          {!t.is_active && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-red-500 bg-red-50 px-1.5 py-0.5 rounded-md border border-red-100">
              Révoqué
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <code className="text-xs text-slate-400 font-mono">{t.token_prefix}</code>
          <button onClick={copyPrefix}
            className="text-slate-300 hover:text-slate-500 transition-colors">
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Allowed origins */}
      <div className="hidden md:flex flex-col items-end gap-1 shrink-0">
        {t.allowed_origins.length === 0
          ? <span className="text-xs text-slate-400 italic">Toutes origines</span>
          : t.allowed_origins.slice(0, 2).map(o => (
              <span key={o} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-mono max-w-[140px] truncate">{o}</span>
            ))
        }
        {t.allowed_origins.length > 2 && (
          <span className="text-xs text-slate-400">+{t.allowed_origins.length - 2}</span>
        )}
      </div>

      {/* Last used */}
      <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-400 shrink-0 w-28">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        {timeAgo(t.last_used_at)}
      </div>

      {/* Created */}
      <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-400 shrink-0 w-28">
        <span className="text-slate-300">créé</span> {fmtDate(t.created_at)}
      </div>

      {/* Actions */}
      {t.is_active && (
        <button
          onClick={() => onRevoke(t)}
          title="Révoquer ce token"
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TokensPage() {
  const { projectId } = useParams<{ projectId: string }>()

  const [tokens,      setTokens]      = useState<AccessToken[]>([])
  const [loading,     setLoading]     = useState(true)
  const [showCreate,  setShowCreate]  = useState(false)
  const [newResult,   setNewResult]   = useState<NewTokenResult | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<AccessToken | null>(null)

  const onboarderUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

  const load = useCallback(async () => {
    setLoading(true)
    const sb = createClient()
    const { data } = await sb
      .from("onboarder_access_tokens")
      .select("id, label, token_prefix, scope, allowed_origins, is_active, last_used_at, created_at, revoked_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
    setTokens((data as AccessToken[]) ?? [])
    setLoading(false)
  }, [projectId])

  useEffect(() => { load() }, [load])

  function handleCreated(result: NewTokenResult) {
    setShowCreate(false)
    setNewResult(result)
    load()
  }

  function handleRevoked(id: string) {
    setRevokeTarget(null)
    setTokens(prev => prev.map(t => t.id === id ? { ...t, is_active: false, revoked_at: new Date().toISOString() } : t))
  }

  const active  = tokens.filter(t => t.is_active)
  const revoked = tokens.filter(t => !t.is_active)

  return (
    <div className="p-8 space-y-8 max-w-4xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tokens d'accès</h1>
          <p className="text-sm text-slate-500 mt-1">
            Générez des tokens pour intégrer votre agent dans n'importe quelle application sans exposer vos clés Supabase.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors shrink-0 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Nouveau token
        </button>
      </div>

      {/* How it works */}
      <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl p-5 border border-indigo-100">
        <h2 className="text-sm font-semibold text-indigo-900 mb-3">Comment ça marche ?</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { n: "1", title: "Générez un token", desc: "Un token opaque lié à ce projet. Nous ne stockons que son hash SHA-256." },
            { n: "2", title: "Ajoutez-le au SaaS client", desc: "Collez le token dans votre .env.local et ajoutez le composant dans votre layout." },
            { n: "3", title: "L'agent se charge automatiquement", desc: "Le widget charge sa configuration (nom, couleur, messages) depuis votre dashboard Onboarder." },
          ].map(s => (
            <div key={s.n} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{s.n}</div>
              <div>
                <p className="text-sm font-semibold text-indigo-900">{s.title}</p>
                <p className="text-xs text-indigo-700 mt-0.5 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Code snippet */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Intégration React</h2>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">layout.tsx</span>
        </div>
        <pre className="bg-slate-950 text-slate-300 text-xs rounded-xl p-4 font-mono overflow-x-auto leading-relaxed">{
`import { OnboarderAgent } from "@/components/onboarder/OnboarderAgent"

// Dans votre layout :
<OnboarderAgent
  token={process.env.NEXT_PUBLIC_ONBOARDER_TOKEN!}
  onboarderUrl={process.env.NEXT_PUBLIC_ONBOARDER_URL!}
/>`
        }</pre>
      </div>

      {/* Token list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <svg className="w-6 h-6 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3V4a10 10 0 100 10h-2a8 8 0 01-8-8z"/>
          </svg>
        </div>
      ) : tokens.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
            <KeyRound className="w-7 h-7 text-slate-300" />
          </div>
          <p className="font-semibold text-slate-700">Aucun token pour ce projet</p>
          <p className="text-sm text-slate-400 mt-1 mb-5">Générez votre premier token pour intégrer l'agent.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" /> Créer un token
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-semibold text-slate-700">Actifs ({active.length})</h3>
              </div>
              {active.map(t => (
                <TokenRow key={t.id} token={t} onRevoke={setRevokeTarget} />
              ))}
            </div>
          )}

          {revoked.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <ShieldOff className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-400">Révoqués ({revoked.length})</h3>
              </div>
              {revoked.map(t => (
                <TokenRow key={t.id} token={t} onRevoke={setRevokeTarget} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateModal
          projectId={projectId}
          onboarderUrl={onboarderUrl}
          onCreated={handleCreated}
          onClose={() => setShowCreate(false)}
        />
      )}
      {newResult && (
        <TokenRevealModal
          result={newResult}
          onClose={() => setNewResult(null)}
        />
      )}
      {revokeTarget && (
        <RevokeConfirm
          token={revokeTarget}
          onboarderUrl={onboarderUrl}
          onRevoked={handleRevoked}
          onClose={() => setRevokeTarget(null)}
        />
      )}
    </div>
  )
}
