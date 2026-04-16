// This layout only wraps legacy /dashboard/* routes (knowledge, analytics, config, install).
// New project-scoped routes use /dashboard/[projectId]/layout.tsx instead.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
