/**
 * @onboarder/sdk/vue
 *
 * Vue 3 wrapper — provides a plugin and a composable.
 *
 * Usage (plugin — install once in main.ts):
 *   import { OnboarderPlugin } from '@onboarder/sdk/vue';
 *
 *   app.use(OnboarderPlugin, {
 *     projectId  : 'proj_xxx',
 *     anonKey    : 'eyJ...',
 *     supabaseUrl: 'https://xxx.supabase.co',
 *   });
 *
 * Usage (composable — in any component):
 *   import { useOnboarder } from '@onboarder/sdk/vue';
 *
 *   const { isReady, sessionId, execute } = useOnboarder();
 *
 * Usage (standalone composable — without plugin):
 *   const { isReady, execute } = useOnboarderDirect({
 *     projectId, anonKey, supabaseUrl, userId, userTraits,
 *   });
 */

import { ref, onMounted, onUnmounted, type App } from "vue";
import { OnboarderSDK, type SDKConfig, type AgentAction, type ActionResult } from "./core.js";

// ─── Plugin ───────────────────────────────────────────────────────────────────

const INJECTION_KEY = Symbol("onboarder");

interface PluginState {
  sdk      : OnboarderSDK;
  isReady  : ReturnType<typeof ref<boolean>>;
  sessionId: ReturnType<typeof ref<string | null>>;
}

export const OnboarderPlugin = {
  install(app: App, config: SDKConfig) {
    const sdk       = new OnboarderSDK();
    const isReady   = ref(false);
    const sessionId = ref<string | null>(null);

    sdk
      .init(config)
      .then(() => {
        sessionId.value = sdk.getSessionId();
        isReady.value   = true;
      })
      .catch((err) => console.error("[Onboarder] init error", err));

    const state: PluginState = { sdk, isReady, sessionId };
    app.provide(INJECTION_KEY, state);

    // Cleanup when app is unmounted
    app.config.globalProperties.$onboarder = {
      execute: (actions: Omit<AgentAction, "id" | "sequence">[]) => sdk.execute(actions),
      destroy: () => sdk.destroy(),
    };
  },
};

// ─── Composable (requires plugin) ────────────────────────────────────────────

import { inject } from "vue";

export function useOnboarder() {
  const state = inject<PluginState>(INJECTION_KEY);
  if (!state) {
    throw new Error(
      "useOnboarder() requires OnboarderPlugin to be installed. " +
      "Use app.use(OnboarderPlugin, config) in main.ts, " +
      "or use useOnboarderDirect(config) for a standalone setup."
    );
  }

  return {
    isReady  : state.isReady,
    sessionId: state.sessionId,
    execute  : (actions: Omit<AgentAction, "id" | "sequence">[]) => state.sdk.execute(actions),
    destroy  : () => state.sdk.destroy(),
  };
}

// ─── Standalone composable (no plugin needed) ─────────────────────────────────

/**
 * Initializes the SDK inside a component lifecycle.
 * Call at the top level of setup() — not inside a conditional.
 */
export function useOnboarderDirect(config: SDKConfig) {
  const sdk       = new OnboarderSDK();
  const isReady   = ref(false);
  const sessionId = ref<string | null>(null);

  onMounted(() => {
    sdk
      .init(config)
      .then(() => {
        sessionId.value = sdk.getSessionId();
        isReady.value   = true;
      })
      .catch((err) => console.error("[Onboarder] init error", err));
  });

  onUnmounted(() => sdk.destroy());

  return {
    isReady,
    sessionId,
    execute: (actions: Omit<AgentAction, "id" | "sequence">[]) => sdk.execute(actions),
    destroy: () => sdk.destroy(),
  };
}

export type { SDKConfig, AgentAction, ActionResult };
