"use client";

import { type ReactNode } from "react";
import { OnboarderWidget as SDKWidget } from "@onboarder/sdk/widget";

// Public token — set NEXT_PUBLIC_ONBOARDER_TOKEN in your .env.local
const ONBOARDER_TOKEN = process.env.NEXT_PUBLIC_ONBOARDER_TOKEN
  ?? "ob_live_9863678de827220bf343647a91c499c0";

interface Props {
  userId?  : string;
  children : ReactNode;
}

/**
 * Renders the page children + the floating Onboarder chat widget.
 * SDKWidget is self-contained: it fetches its own config via the token
 * and mounts the chat bubble in the DOM.
 */
export function OnboarderWidget({ userId, children }: Props) {
  return (
    <>
      {children}
      <SDKWidget
        token={ONBOARDER_TOKEN}
        onboarderUrl={process.env.NEXT_PUBLIC_SUPABASE_URL!}
        userId={userId}
      />
    </>
  );
}
