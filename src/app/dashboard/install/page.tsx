import { Header } from "@/components/layout/Header"
import { InstallSnippet } from "@/components/dashboard/InstallSnippet"
import { createServiceClient, getWorkspaceId } from "@/lib/supabase-server"
import { CheckCircle } from "lucide-react"

export default async function InstallPage() {
  const db = createServiceClient()
  const wsId = getWorkspaceId()

  const { data: workspace } = await db
    .from("onboarder_workspaces")
    .select("id, pub_token, name")
    .eq("id", wsId)
    .maybeSingle()

  const token = workspace?.pub_token ?? "pub_tok_xxxx"
  const workspaceId = workspace?.id ?? wsId

  return (
    <div>
      <Header title="Installation" subtitle="Intégrez l'agent en 3 lignes" />
      <div className="p-8 max-w-3xl space-y-8">
        <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl p-6 border border-indigo-100">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            Prêt en 2 minutes
          </h2>
          <p className="text-slate-600 text-sm">
            Copiez le snippet dans le{" "}
            <code className="bg-white px-1.5 py-0.5 rounded text-xs font-mono border border-slate-200">
              &lt;head&gt;
            </code>{" "}
            de votre application. C&apos;est tout.
          </p>
        </div>

        <InstallSnippet workspaceId={workspaceId} token={token} />

        <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100 flex items-start gap-4">
          <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-emerald-800">
              Aucune dépendance, CSP-compatible
            </p>
            <p className="text-sm text-emerald-700 mt-1">
              Le snippet utilise uniquement vanilla JS et Shadow DOM. Il ne
              touche pas au CSS ou au DOM de votre application.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
