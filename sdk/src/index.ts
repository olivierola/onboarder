/**
 * index.ts — IIFE entry point (for <script> tag usage)
 *
 * Exposes window.Onboarder and auto-inits from data-* attributes.
 * Framework users (React/Vue/Angular/PHP) should import from the
 * specific sub-package instead of this file.
 */

import { OnboarderSDK } from "./core";
import type { SDKConfig, AgentAction } from "./core";

// Guard browser-only side-effects (window/document) from SSR
if (typeof window !== "undefined") {
  const sdk = new OnboarderSDK();

  (window as unknown as Record<string, unknown>).Onboarder = {
    init         : (config: SDKConfig) => sdk.init(config),
    execute      : (actions: Parameters<typeof sdk.execute>[0]) => sdk.execute(actions),
    playFlow     : (flowId: string, startStep?: number) => sdk.playFlow(flowId, startStep),
    loadContent  : () => sdk.loadContent(),
    destroy      : () => sdk.destroy(),
    getSessionId : () => sdk.getSessionId(),
    _sdk         : sdk,
  };

  // Auto-init from <script data-project-id="..." data-anon-key="..." data-supabase-url="...">
  const scriptEl = document.currentScript as HTMLScriptElement | null;
  if (scriptEl) {
    const projectId   = scriptEl.getAttribute("data-project-id");
    const anonKey     = scriptEl.getAttribute("data-anon-key");
    const supabaseUrl = scriptEl.getAttribute("data-supabase-url");

    if (projectId && anonKey && supabaseUrl) {
      sdk.init({
        projectId,
        anonKey,
        supabaseUrl,
        userId    : scriptEl.getAttribute("data-user-id")     ?? undefined,
        userTraits: JSON.parse(scriptEl.getAttribute("data-user-traits") ?? "{}"),
        locale    : scriptEl.getAttribute("data-locale")       ?? undefined,
      });
    }
  }
}

export { OnboarderSDK } from "./core";
export { OnboarderWidget } from "./widget";
export type { SDKConfig, AgentAction } from "./core";
export type { OnboarderWidgetProps } from "./widget";
