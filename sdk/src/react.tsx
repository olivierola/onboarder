/**
 * @onboarder/sdk/react
 *
 * React wrapper — provides a hook and a context provider.
 *
 * Usage (minimal):
 *   import { OnboarderProvider } from '@onboarder/sdk/react';
 *
 *   <OnboarderProvider
 *     projectId="proj_xxx"
 *     anonKey="eyJ..."
 *     supabaseUrl="https://xxx.supabase.co"
 *     userId={currentUser.id}
 *     userTraits={{ plan: 'pro', role: 'admin' }}
 *   >
 *     <App />
 *   </OnboarderProvider>
 *
 * Usage (hook):
 *   const { isReady, execute, sessionId } = useOnboarder();
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { OnboarderSDK, type SDKConfig, type AgentAction, type ActionResult } from "./core.js";

// ─── Context ──────────────────────────────────────────────────────────────────

interface OnboarderContextValue {
  isReady  : boolean;
  sessionId: string | null;
  execute  : (actions: Omit<AgentAction, "id" | "sequence">[]) => Promise<ActionResult[]>;
  destroy  : () => void;
}

const OnboarderContext = createContext<OnboarderContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * Two init modes:
 *   1. Token mode (recommended for SaaS integrations):
 *      <OnboarderProvider token="ob_live_..." onboarderUrl="https://xxx.supabase.co">
 *
 *   2. Direct mode (for the Onboarder dashboard itself):
 *      <OnboarderProvider projectId="..." anonKey="..." supabaseUrl="...">
 */
type ProviderProps =
  | (SDKConfig                                      & { children: ReactNode; token?: never; onboarderUrl?: never })
  | ({ token: string; onboarderUrl: string }        & Partial<Pick<SDKConfig,"userId"|"userTraits"|"locale">> & { children: ReactNode });

export function OnboarderProvider(props: ProviderProps) {
  const { children, userId, userTraits, locale } = props as ProviderProps & {
    userId?     : string;
    userTraits? : Record<string,unknown>;
    locale?     : string;
  };

  const sdkRef                    = useRef<OnboarderSDK | null>(null);
  const [isReady, setIsReady]     = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    const sdk = new OnboarderSDK();
    sdkRef.current = sdk;

    const initPromise = "token" in props && props.token
      ? sdk.initFromToken(props.token, props.onboarderUrl, { userId, userTraits, locale })
      : sdk.init({ ...(props as SDKConfig), userId, userTraits, locale });

    initPromise
      .then(() => {
        setSessionId(sdk.getSessionId());
        setIsReady(true);
      })
      .catch((err) => console.error("[Onboarder] init error", err));

    return () => {
      sdk.destroy();
      sdkRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    "token" in props ? props.token        : (props as SDKConfig).projectId,
    "token" in props ? props.onboarderUrl : (props as SDKConfig).supabaseUrl,
  ]);

  const execute = (actions: Omit<AgentAction, "id" | "sequence">[]) =>
    sdkRef.current?.execute(actions) ?? Promise.resolve([]);

  const destroy = () => {
    sdkRef.current?.destroy();
    setIsReady(false);
    setSessionId(null);
  };

  return (
    <OnboarderContext.Provider value={{ isReady, sessionId, execute, destroy }}>
      {children}
    </OnboarderContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns the Onboarder context.
 * Must be used inside an <OnboarderProvider>.
 */
export function useOnboarder(): OnboarderContextValue {
  const ctx = useContext(OnboarderContext);
  if (!ctx) {
    throw new Error("useOnboarder() must be used inside <OnboarderProvider>");
  }
  return ctx;
}

// ─── Low-level hook (direct SDK access) ──────────────────────────────────────

/**
 * Alternative to the provider — initializes the SDK directly in a component.
 * Useful when you can't wrap your app in a provider (e.g. portals, micro-frontends).
 */
export function useOnboarderDirect(config: SDKConfig | null): OnboarderContextValue {
  const sdkRef                    = useRef<OnboarderSDK | null>(null);
  const [isReady, setIsReady]     = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (!config) return;

    const sdk = new OnboarderSDK();
    sdkRef.current = sdk;

    sdk
      .init(config)
      .then(() => {
        setSessionId(sdk.getSessionId());
        setIsReady(true);
      })
      .catch((err) => console.error("[Onboarder] init error", err));

    return () => {
      sdk.destroy();
      sdkRef.current = null;
      setIsReady(false);
      setSessionId(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.projectId, config?.anonKey, config?.supabaseUrl]);

  return {
    isReady,
    sessionId,
    execute: (actions) => sdkRef.current?.execute(actions) ?? Promise.resolve([]),
    destroy: () => { sdkRef.current?.destroy(); setIsReady(false); setSessionId(null); },
  };
}

export type { SDKConfig, AgentAction, ActionResult };
