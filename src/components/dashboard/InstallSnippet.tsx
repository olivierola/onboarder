"use client"
import { useState } from "react"
import { Copy, Check } from "lucide-react"

interface Props {
  workspaceId: string
  token: string
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: select text
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="absolute top-3 right-3 p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
      title="Copier"
    >
      {copied ? (
        <Check className="w-4 h-4 text-emerald-400" />
      ) : (
        <Copy className="w-4 h-4" />
      )}
    </button>
  )
}

export function InstallSnippet({ workspaceId, token }: Props) {
  const snippetCode = `<script
  src="https://cdn.saasonboarder.io/v1/onboarder.min.js"
  data-workspace="${workspaceId}"
  data-token="${token}"
  data-locale="fr"
  async>
</script>`

  const identifyCode = `// Après la connexion de l'utilisateur :
window.SaaSOnboarder.identify({
  userId:    'user_123',
  name:      'Alice',
  role:      'admin',
  plan:      'pro',
  createdAt: '2026-01-15',
});`

  const triggerCode = `// Signaler un événement :
window.SaaSOnboarder.trigger('feature_used', { feature: 'export_csv' });

// Ouvrir avec une question :
window.SaaSOnboarder.ask('Comment exporter mes données ?');`

  const steps = [
    { step: "1", title: "Copiez le snippet dans votre <head>", code: snippetCode },
    { step: "2", title: "Identifiez vos utilisateurs (optionnel)", code: identifyCode },
    { step: "3", title: "Signalez des événements (optionnel)", code: triggerCode },
  ]

  return (
    <div className="space-y-6">
      {steps.map((s) => (
        <div
          key={s.step}
          className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
        >
          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
            <div className="w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
              {s.step}
            </div>
            <h3 className="font-semibold text-slate-800">{s.title}</h3>
          </div>
          <div className="relative">
            <pre className="bg-slate-950 text-slate-300 p-5 text-sm font-mono overflow-x-auto leading-relaxed">
              <code>{s.code}</code>
            </pre>
            <CopyButton text={s.code} />
          </div>
        </div>
      ))}
    </div>
  )
}
