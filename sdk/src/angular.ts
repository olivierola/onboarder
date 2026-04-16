/**
 * @onboarder/sdk/angular
 *
 * Angular adapter — a plain class designed to be wrapped as an Angular service.
 *
 * No dependency on @angular/core is required at build time, making the SDK
 * framework-agnostic at compile time. Angular decorators are added by the
 * consuming app (see usage below).
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 * 1. Create a service in your Angular app (one-time setup):
 *
 *    // src/app/onboarder.service.ts
 *    import { Injectable, OnDestroy } from '@angular/core';
 *    import { OnboarderAdapter, type SDKConfig } from '@onboarder/sdk/angular';
 *
 *    @Injectable({ providedIn: 'root' })
 *    export class OnboarderService extends OnboarderAdapter implements OnDestroy {
 *      constructor() {
 *        super();
 *        this.init({
 *          projectId  : environment.onboarderProjectId,
 *          anonKey    : environment.onboarderAnonKey,
 *          supabaseUrl: environment.supabaseUrl,
 *        });
 *      }
 *
 *      ngOnDestroy() { this.destroy(); }
 *    }
 *
 * 2. Inject and use in any component:
 *
 *    @Component({ ... })
 *    export class AppComponent {
 *      constructor(private onboarder: OnboarderService) {}
 *
 *      spotlight(selector: string) {
 *        this.onboarder.execute([{
 *          action_type: 'spotlight_card',
 *          target: {},
 *          data: { selector, title: 'Voici le bouton', body: 'Cliquez ici pour continuer.' },
 *        }]);
 *      }
 *    }
 *
 * ─── With Signals (Angular 17+) ──────────────────────────────────────────────
 *
 *    @Injectable({ providedIn: 'root' })
 *    export class OnboarderService extends OnboarderSignalAdapter implements OnDestroy {
 *      constructor() {
 *        super();
 *        this.init({ projectId, anonKey, supabaseUrl });
 *      }
 *      ngOnDestroy() { this.destroy(); }
 *    }
 *
 *    // In component (Angular 17+ signal-based)
 *    isReady  = inject(OnboarderService).isReady;   // Signal<boolean>
 *    sessionId = inject(OnboarderService).sessionId; // Signal<string | null>
 */

import { OnboarderSDK, type SDKConfig, type AgentAction, type ActionResult } from "./core.js";

// ─── Base adapter (works with Angular 2–17+ using RxJS or plain callbacks) ───

export class OnboarderAdapter {
  protected sdk              = new OnboarderSDK();
  private   _isReady         = false;
  private   _sessionId       : string | null = null;
  private   _readyCallbacks  : Array<() => void> = [];

  async init(config: SDKConfig): Promise<void> {
    await this.sdk.init(config);
    this._sessionId  = this.sdk.getSessionId();
    this._isReady    = true;
    this._readyCallbacks.forEach((cb) => cb());
    this._readyCallbacks = [];
  }

  /** Returns true once the session is established */
  get isReady():   boolean      { return this._isReady;   }
  get sessionId(): string | null { return this._sessionId; }

  /** Execute UI actions programmatically */
  execute(actions: Omit<AgentAction, "id" | "sequence">[]): Promise<ActionResult[]> {
    return this.sdk.execute(actions);
  }

  /**
   * Register a callback fired once (or immediately if already ready).
   * Useful for Angular lifecycle hooks that run after init().
   */
  onReady(cb: () => void): void {
    if (this._isReady) { cb(); return; }
    this._readyCallbacks.push(cb);
  }

  destroy(): void {
    this.sdk.destroy();
    this._isReady    = false;
    this._sessionId  = null;
  }
}

// ─── Signal adapter (Angular 17+ with native signals) ────────────────────────

/**
 * Extends OnboarderAdapter with Angular Signals for reactive state.
 * Import signal/computed from @angular/core in your service if needed.
 *
 * Because @angular/core is a peer dependency, we avoid importing it here.
 * Instead we expose a helper to bind signals manually:
 *
 *   class MyService extends OnboarderSignalAdapter {
 *     readonly isReady   = signal(false);
 *     readonly sessionId = signal<string | null>(null);
 *
 *     constructor() {
 *       super();
 *       // Bind the base adapter callbacks to your signals
 *       this.bindSignals(this.isReady, this.sessionId);
 *     }
 *   }
 */
export class OnboarderSignalAdapter extends OnboarderAdapter {
  /**
   * Accepts Angular signal setters — called when state changes.
   * Pass any object with a `set` method (Angular WritableSignal<T>).
   */
  bindSignals(
    isReadySignal  : { set: (v: boolean)       => void },
    sessionIdSignal: { set: (v: string | null) => void },
  ): void {
    this.onReady(() => {
      isReadySignal.set(true);
      sessionIdSignal.set(this.sessionId);
    });
  }
}

// ─── RxJS adapter (Angular 2–16, or any RxJS-based app) ──────────────────────

/**
 * Extends OnboarderAdapter with RxJS Observables.
 * Requires rxjs as a peer dependency (already present in all Angular projects).
 *
 * Usage:
 *   @Injectable({ providedIn: 'root' })
 *   export class OnboarderService extends OnboarderRxAdapter implements OnDestroy { ... }
 *
 *   // In component template:
 *   *ngIf="onboarder.isReady$ | async"
 */
export class OnboarderRxAdapter extends OnboarderAdapter {
  // Lazy-loaded to avoid pulling rxjs into tree if not used
  private _subjects: {
    isReady  : { next: (v: boolean)       => void; asObservable: () => unknown };
    sessionId: { next: (v: string | null) => void; asObservable: () => unknown };
  } | null = null;

  get isReady$()   { return this._getSubjects().isReady.asObservable();   }
  get sessionId$() { return this._getSubjects().sessionId.asObservable(); }

  private _getSubjects() {
    if (!this._subjects) {
      // Dynamic import avoids bundling rxjs if unused
      throw new Error(
        "OnboarderRxAdapter: call initRx() before accessing isReady$ / sessionId$"
      );
    }
    return this._subjects;
  }

  /**
   * Must be called once with BehaviorSubject from rxjs.
   *
   *   import { BehaviorSubject } from 'rxjs';
   *   this.initRx(
   *     new BehaviorSubject<boolean>(false),
   *     new BehaviorSubject<string | null>(null),
   *   );
   */
  initRx(
    isReadySubject  : { next: (v: boolean)       => void; asObservable: () => unknown },
    sessionIdSubject: { next: (v: string | null) => void; asObservable: () => unknown },
  ): void {
    this._subjects = { isReady: isReadySubject, sessionId: sessionIdSubject };
    this.onReady(() => {
      isReadySubject.next(true);
      sessionIdSubject.next(this.sessionId);
    });
  }

  override destroy(): void {
    super.destroy();
    this._subjects?.isReady.next(false);
    this._subjects?.sessionId.next(null);
  }
}

export type { SDKConfig, AgentAction, ActionResult };
