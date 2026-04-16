"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Copy, Check, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://xxx.supabase.co";

type Tab = "html" | "react" | "npm";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="absolute top-3 right-3 inline-flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
    >
      {copied ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copié</> : <><Copy className="w-3.5 h-3.5" /> Copier</>}
    </button>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative">
      <pre className="bg-gray-950 text-green-400 text-xs rounded-xl p-5 overflow-x-auto leading-relaxed font-mono whitespace-pre">
        {code}
      </pre>
      <CopyButton text={code} />
    </div>
  );
}

export default function InstallPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [tab, setTab] = useState<Tab>("html");

  const htmlSnippet = `<script
  src="https://cdn.yourdomain.com/onboarder.min.js"
  data-project-id="${projectId}"
  data-supabase-url="${SUPABASE_URL}"
  async
></script>`;

  const npmInstall = `npm install @onboarder/sdk
# ou
yarn add @onboarder/sdk`;

  const reactSnippet = `// 1. Enveloppez votre app dans le provider
import { OnboarderProvider } from '@onboarder/sdk/react';

export default function App({ children }) {
  return (
    <OnboarderProvider
      projectId="${projectId}"
      supabaseUrl="${SUPABASE_URL}"
      anonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}
      userId={currentUser.id}          // optionnel
      userTraits={{ plan: 'pro' }}     // optionnel
    >
      {children}
    </OnboarderProvider>
  );
}

// 2. Utilisez le hook dans n'importe quel composant enfant
import { useOnboarder } from '@onboarder/sdk/react';

function MyComponent() {
  const { isReady, sessionId } = useOnboarder();
  return <div>{isReady ? \`Session: \${sessionId}\` : 'Chargement...'}</div>;
}`;

  const TABS: { id: Tab; label: string }[] = [
    { id: "html",  label: "HTML (script tag)" },
    { id: "react", label: "React / Next.js" },
    { id: "npm",   label: "npm install" },
  ];

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Installation</h1>
        <p className="text-sm text-slate-500 mt-1">
          Intégrez l'agent en quelques lignes dans votre application.
        </p>
      </div>

      <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl p-6 border border-indigo-100">
        <h2 className="text-base font-semibold text-slate-900 mb-1">Prêt en 2 minutes</h2>
        <p className="text-slate-600 text-sm">
          Choisissez le mode d'intégration qui correspond à votre stack.
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "px-4 py-1.5 text-sm font-medium rounded-lg transition-colors",
                tab === t.id
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "html" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Collez ce snippet dans le{" "}
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono border border-slate-200">
                &lt;head&gt;
              </code>{" "}
              de votre application.
            </p>
            <CodeBlock code={htmlSnippet} />
            <p className="text-xs text-slate-400">
              L'attribut <code className="bg-slate-100 px-1 rounded">data-project-id</code> identifie
              ce projet. Chaque application SaaS utilise un ID différent.
            </p>
          </div>
        )}

        {tab === "react" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">1. Installez le paquet</p>
              <CodeBlock code={npmInstall} />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">2. Intégrez le provider et le hook</p>
              <CodeBlock code={reactSnippet} />
            </div>
          </div>
        )}

        {tab === "npm" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Installez le SDK via npm, yarn ou pnpm.
            </p>
            <CodeBlock code={npmInstall} />
            <div className="bg-slate-50 rounded-xl p-4 text-xs text-slate-600 space-y-1 border border-slate-100">
              <p className="font-semibold text-slate-700 mb-2">Exports disponibles</p>
              <p><code className="bg-white px-1.5 rounded border border-slate-200">@onboarder/sdk</code> — Core framework-agnostique</p>
              <p><code className="bg-white px-1.5 rounded border border-slate-200">@onboarder/sdk/react</code> — Provider + hook React</p>
              <p><code className="bg-white px-1.5 rounded border border-slate-200">@onboarder/sdk/vue</code> — Composable Vue 3</p>
              <p><code className="bg-white px-1.5 rounded border border-slate-200">@onboarder/sdk/angular</code> — Service Angular</p>
              <p><code className="bg-white px-1.5 rounded border border-slate-200">@onboarder/sdk/widget</code> — Widget autonome</p>
            </div>
          </div>
        )}
      </div>

      {/* Vérification */}
      <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100 flex items-start gap-4">
        <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold text-emerald-800">Aucune dépendance, CSP-compatible</p>
          <p className="text-sm text-emerald-700 mt-1">
            Le widget utilise Shadow DOM. Il ne touche pas au CSS ou au DOM de votre application.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Étapes de vérification</h2>
        <ol className="space-y-3 text-sm text-slate-600">
          {[
            "Intégrez le snippet ou le provider dans votre app",
            "Ouvrez votre app — l'icône de l'agent apparaît en bas à droite",
            "Cliquez sur l'agent et posez une question",
            "Revenez ici dans Analytics pour voir l'activité",
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center font-semibold shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
