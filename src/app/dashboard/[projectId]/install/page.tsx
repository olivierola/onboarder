"use client"

import { useParams } from "next/navigation"
import { useState } from "react"
import { Copy, Check, CheckCircle } from "lucide-react"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

export default function InstallPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [copied, setCopied] = useState(false)

  const snippet = `<script
  src="https://cdn.yourdomain.com/onboarder.min.js"
  data-project-id="${projectId}"
  data-supabase-url="${SUPABASE_URL}"
  async
></script>`

  const copy = () => {
    navigator.clipboard.writeText(snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Installation</h1>
        <p className="text-sm text-slate-500 mt-1">Intégrez l'agent en une seule ligne dans votre application.</p>
      </div>

      <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl p-6 border border-indigo-100">
        <h2 className="text-base font-semibold text-slate-900 mb-1">Prêt en 2 minutes</h2>
        <p className="text-slate-600 text-sm">
          Copiez le snippet dans le{" "}
          <code className="bg-white px-1.5 py-0.5 rounded text-xs font-mono border border-slate-200">&lt;head&gt;</code>
          {" "}de votre application.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Snippet HTML</h2>
          <button onClick={copy}
            className="inline-flex items-center gap-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            {copied ? <><Check className="w-3.5 h-3.5 text-emerald-600" /> Copié !</> : <><Copy className="w-3.5 h-3.5" /> Copier</>}
          </button>
        </div>
        <pre className="bg-gray-950 text-green-400 text-xs rounded-xl p-5 overflow-x-auto leading-relaxed font-mono whitespace-pre">
          {snippet}
        </pre>
        <p className="text-xs text-slate-400">
          L'attribut <code className="bg-slate-100 px-1 rounded">data-project-id</code> identifie ce projet.
          Chaque application SaaS utilise un ID différent pour isoler ses données.
        </p>
      </div>

      <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100 flex items-start gap-4">
        <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold text-emerald-800">Aucune dépendance, CSP-compatible</p>
          <p className="text-sm text-emerald-700 mt-1">
            Le snippet utilise uniquement vanilla JS et Shadow DOM. Il ne touche pas au CSS
            ou au DOM de votre application.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Étapes de vérification</h2>
        <ol className="space-y-3 text-sm text-slate-600">
          {[
            "Copiez le snippet dans le <head> de votre app",
            "Ouvrez votre app — l'icône de l'agent apparaît en bas à droite",
            "Cliquez sur l'agent et posez une question",
            "Revenez ici dans Analytics pour voir l'activité",
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center font-semibold shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span dangerouslySetInnerHTML={{ __html: step.replace(/<head>/g, '<code class="bg-slate-100 px-1 rounded">&lt;head&gt;</code>') }} />
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
