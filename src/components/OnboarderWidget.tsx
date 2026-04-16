"use client";

import { type ReactNode } from "react";
import { OnboarderProvider } from "@onboarder/sdk/react";

interface Props {
  projectId : string;
  userId?   : string;
  children  : ReactNode;
}

/**
 * Client wrapper that boots the Onboarder SDK for the current project.
 * Place this around the app shell so the floating widget is available
 * on every dashboard page for that project.
 */
export function OnboarderWidget({ projectId, userId, children }: Props) {
  return (
    <OnboarderProvider
      projectId={projectId}
      anonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}
      supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL!}
      userId={userId}
    >
      {children}
    </OnboarderProvider>
  );
}
