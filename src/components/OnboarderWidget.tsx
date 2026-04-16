"use client";

import { type ReactNode } from "react";
import { OnboarderProvider } from "@onboarder/sdk/react";

// Public token — set NEXT_PUBLIC_ONBOARDER_TOKEN in your .env.local
const ONBOARDER_TOKEN = process.env.NEXT_PUBLIC_ONBOARDER_TOKEN
  ?? "ob_live_9863678de827220bf343647a91c499c0";

interface Props {
  userId?  : string;
  children : ReactNode;
}

/**
 * Client wrapper that boots the Onboarder SDK via token mode.
 * Place this around the app shell so the floating widget is available
 * on every dashboard page.
 */
export function OnboarderWidget({ userId, children }: Props) {
  return (
    <OnboarderProvider
      token={ONBOARDER_TOKEN}
      onboarderUrl={process.env.NEXT_PUBLIC_SUPABASE_URL!}
      userId={userId}
    >
      {children}
    </OnboarderProvider>
  );
}
