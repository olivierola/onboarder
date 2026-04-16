import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center space-y-8">
        <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 px-4 py-1.5 rounded-full text-sm font-medium">
          <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
          Beta — Invitation uniquement
        </div>

        <h1 className="text-5xl font-bold tracking-tight text-slate-900">
          L'agent IA qui onboarde
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-violet-600"> vos users</span>
        </h1>

        <p className="text-xl text-slate-600 max-w-lg mx-auto">
          Un snippet JS. Groq en 200ms. Vos utilisateurs guidés en temps réel — sans toucher à votre codebase.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/dashboard"
            className="px-8 py-3.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
          >
            Accéder au dashboard
          </Link>
          <Link
            href="/dashboard/install"
            className="px-8 py-3.5 bg-white text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors border border-slate-200 shadow"
          >
            Voir l'installation
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-6 pt-8">
          {[
            { label: "Latence", value: "<200ms", icon: "⚡" },
            { label: "Taille snippet", value: "~18kb", icon: "📦" },
            { label: "Marge brute", value: "96%", icon: "📈" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <div className="text-3xl mb-2">{s.icon}</div>
              <div className="text-2xl font-bold text-slate-900">{s.value}</div>
              <div className="text-sm text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
