export const dynamic = "force-dynamic";

import { redirect }          from "next/navigation";
import { Sidebar }           from "@/components/layout/Sidebar";
import { BreadcrumbBar }     from "@/components/layout/Breadcrumb";
import { createClient }      from "@/lib/supabase-server";
import { OnboarderWidget }   from "@/components/OnboarderWidget";

export default async function ProjectDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/dashboard/${projectId}`);

  const { data: project } = await supabase
    .from("onboarder_projects")
    .select("id, name, status")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) redirect("/projects");

  return (
    <OnboarderWidget userId={user.id}>
      <div className="flex h-screen bg-black overflow-hidden">
        <Sidebar projectId={projectId} projectName={project.name} />
        <div className="flex-1 flex flex-col min-h-0">
          <BreadcrumbBar projectId={projectId} projectName={project.name} />
          {/* Content card — floating on the black background */}
          <div className="flex-1 min-h-0 px-3 pb-3 pt-1.5">
            {/* Outer: clips rounded corners. Inner: scrolls */}
            <div className="h-full bg-[#f8f8fb] rounded-xl overflow-hidden shadow-sm">
              <main className="h-full overflow-y-auto content-scroll">
                {children}
              </main>
            </div>
          </div>
        </div>
      </div>
    </OnboarderWidget>
  );
}
