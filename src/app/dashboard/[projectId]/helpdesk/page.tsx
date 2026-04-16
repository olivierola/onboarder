import { redirect } from "next/navigation";

export default async function HelpdeskIndex({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/dashboard/${projectId}/helpdesk/inbox`);
}
