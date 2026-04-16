"use client"
/**
 * @onboarder/sdk/widget
 *
 * Self-contained chat widget driven entirely by the project config stored
 * in the Onboarder dashboard.
 *
 * The SaaS client only needs to pass a token (and optionally user info):
 *
 *   import { OnboarderWidget } from '@onboarder/sdk/widget'
 *
 *   <OnboarderWidget
 *     token={process.env.NEXT_PUBLIC_ONBOARDER_TOKEN}
 *     onboarderUrl={process.env.NEXT_PUBLIC_ONBOARDER_URL}
 *     userId={currentUser.id}
 *     userTraits={{ plan: 'pro', role: 'admin' }}
 *   />
 *
 * Everything else (name, emoji, colors, position, welcome message, locale)
 * is fetched from the Onboarder backend via token-exchange and stored in
 * the project's `config` JSONB column.
 */

import {
  useEffect, useRef, useState, useCallback,
  type ReactNode,
} from "react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProjectConfig {
  agentName?         : string   // "Assistant"
  agentEmoji?        : string   // "🤖"
  primaryColor?      : string   // "#6366f1"
  widgetPosition?    : "bottom-right" | "bottom-left"
  welcomeMessage?    : string
  locale?            : string   // "fr"
  tone?              : string
  avatarUrl?         : string   // optional custom avatar
  poweredByHidden?   : boolean  // hide "Powered by Onboarder"
}

interface BootstrapConfig {
  projectId    : string
  anonKey      : string
  supabaseUrl  : string
  projectConfig: ProjectConfig
  projectName  : string
}

interface Message {
  role      : "user" | "assistant"
  content   : string
  streaming?: boolean
  guideStep?: number   // set when this message announces a guide step
}

export interface OnboarderWidgetProps {
  /** Raw access token (ob_live_…) from the Onboarder dashboard */
  token        : string
  /** Base URL of the Onboarder Supabase project */
  onboarderUrl : string
  /** Authenticated user ID — passed to session for personalisation */
  userId?      : string
  /** Arbitrary traits { plan, role, name, … } */
  userTraits?  : Record<string, unknown>
}

// ─── Guide-step types ─────────────────────────────────────────────────────────

interface DomNode {
  type       : "button" | "link" | "input" | "heading" | "nav" | "text" | "dialog" | "form"
  text?      : string
  selector   : string
  aria_label?: string
  placeholder?: string
  href?      : string
  name?      : string
  classes?   : string
  in_viewport: boolean
}

interface StepRecord {
  step_num   : number
  message    : string
  action_type: string
  selector?  : string
  route      : string
  done_at    : string
}

interface GuideStep {
  message    : string
  action_type: string
  action_data: Record<string, unknown>
  is_done    : boolean
  step_num   : number
  reasoning? : string
}

// Chat flow returned by the chat Edge Function
interface ChatFlowAction {
  type        : string
  [key: string]: unknown   // spotlight_card: {...}, info_modal: {...}, etc.
}

interface ChatFlowStep {
  id          : string
  message     : string
  display_mode: string
  actions     : ChatFlowAction[]
}

interface ChatFlow {
  name : string
  steps: ChatFlowStep[]
}

/** Convert a ChatFlowStep (from chat Edge Function) to GuideStep (used by overlay) */
function chatStepToGuideStep(step: ChatFlowStep, stepNum: number): GuideStep {
  const action = step.actions?.[0]
  if (!action) {
    return {
      message    : step.message,
      action_type: "info_modal",
      action_data: { body: step.message, title: step.message },
      is_done    : false,
      step_num   : stepNum,
    }
  }
  // The action payload is under action[action.type], e.g. action["spotlight_card"]
  const payload = (action[action.type] ?? {}) as Record<string, unknown>
  return {
    message    : step.message,
    action_type: action.type,
    action_data: payload,
    is_done    : false,
    step_num   : stepNum,
  }
}

const BRAND = "#6366f1"

// ─── GuideHighlighter — dynamic spotlight that tracks element on scroll/resize ─
// Ported from linkall-main/sdk/src/player/highlighter.ts

class GuideHighlighter {
  private overlay    : HTMLElement | null = null
  private focusBox   : HTMLElement | null = null
  private selector   : string     | null = null
  private onUpdate   : (() => void) | null = null

  highlight(selector: string, color = BRAND): void {
    this.selector = selector
    this.ensureOverlay(color)
    const el = this.qs(selector)
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" })
    // Small delay for scroll to settle before computing rect
    setTimeout(() => this.update(), 300)
  }

  clear(): void {
    this.selector = null
    if (this.onUpdate) {
      window.removeEventListener("resize", this.onUpdate)
      window.removeEventListener("scroll", this.onUpdate, true)
      this.onUpdate = null
    }
    this.overlay?.remove()
    this.overlay  = null
    this.focusBox = null
  }

  private qs(sel: string): HTMLElement | null {
    try { return document.querySelector(sel) as HTMLElement | null } catch { return null }
  }

  private ensureOverlay(color: string): void {
    if (this.overlay) return

    const ov = document.createElement("div")
    Object.assign(ov.style, {
      position: "fixed", inset: "0", zIndex: "2147483644",
      pointerEvents: "none",
    })

    const box = document.createElement("div")
    Object.assign(box.style, {
      position: "absolute", borderRadius: "10px",
      outline: `3px solid ${color}`,
      outlineOffset: "3px",
      boxShadow: `0 0 0 9999px rgba(0,0,0,0.38), 0 0 14px ${color}88`,
      transition: "all 150ms ease",
      pointerEvents: "none",
    })

    ov.appendChild(box)
    document.body.appendChild(ov)
    this.overlay  = ov
    this.focusBox = box

    this.onUpdate = () => this.update()
    window.addEventListener("resize", this.onUpdate)
    window.addEventListener("scroll", this.onUpdate, true)
  }

  private update(): void {
    if (!this.selector || !this.overlay || !this.focusBox) return
    const el = this.qs(this.selector)
    if (!el) return
    const r = el.getBoundingClientRect()
    const PAD = 6
    Object.assign(this.focusBox.style, {
      top   : `${r.top    - PAD}px`,
      left  : `${r.left   - PAD}px`,
      width : `${r.width  + PAD * 2}px`,
      height: `${r.height + PAD * 2}px`,
    })
  }
}

// ─── ActionExecutor — execute click/input on DOM elements ─────────────────────
// Ported from linkall-main/sdk/src/player/executor.ts

class ActionExecutor {
  execute(step: { action: "click" | "input"; selector: string; value?: string }): boolean {
    const el = this.findEl(step.selector)
    if (!el) return false
    if (step.action === "click") {
      el.click()
    } else if (step.action === "input" && step.value) {
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.value = step.value
        el.dispatchEvent(new Event("input",  { bubbles: true }))
        el.dispatchEvent(new Event("change", { bubbles: true }))
      }
    }
    return true
  }

  private findEl(selector: string): HTMLElement | null {
    if (!selector) return null
    try { return document.querySelector(selector) as HTMLElement | null } catch { return null }
  }
}

// ─── TutorialPlayer — orchestrates library-mode guide steps ──────────────────
// Ported from linkall-main/sdk/src/player/tutorial-player.ts

export interface TutorialStep {
  id?            : string
  index          : number
  instruction    : string
  selector       : string
  action_type    : "click" | "input" | "navigation" | "wait" | "loop" | "condition"
  value?         : string | null
  next_step_id?  : string | null
  exit_step_id?  : string | null
  iterations?    : number
  condition?     : string
}

class TutorialPlayer {
  private steps         : TutorialStep[]
  private current       = 0
  private loopCounts    : Record<string, number> = {}
  private highlighter   = new GuideHighlighter()
  private executor      = new ActionExecutor()
  private activeCleanup : (() => void) | null = null
  private running       = false
  private color         : string

  constructor(steps: TutorialStep[], color = BRAND) {
    this.steps = Array.isArray(steps) ? steps : []
    this.color = color
  }

  isRunning()   { return this.running }
  getProgress() { return { current: this.current, total: this.steps.length } }

  stop(): void {
    this.running = false
    this.clearListeners()
    this.highlighter.clear()
    this.emit("stopped", {})
  }

  async start(mode: "guide" | "autopilot" = "guide"): Promise<void> {
    if (!this.steps.length) return
    this.running   = true
    this.current   = 0
    this.loopCounts = {}
    this.emit("started", { mode })
    if (mode === "autopilot") {
      await this.runAutopilot()
    } else {
      this.presentStep()
    }
  }

  next(customNextId?: string | null): void {
    if (!this.running) return
    this.emit("step_completed", { stepIndex: this.current })
    const step  = this.steps[this.current]
    const nextId = customNextId || step?.next_step_id
    if (nextId) {
      const idx = this.steps.findIndex(s => s.id === nextId)
      if (idx !== -1) { this.current = idx; this.presentStep(); return }
    }
    this.current += 1
    if (this.current >= this.steps.length) { this.complete(); return }
    this.presentStep()
  }

  private complete(): void {
    this.running = false
    this.clearListeners()
    this.highlighter.clear()
    this.emit("completed", {})
  }

  private clearListeners(): void {
    try { this.activeCleanup?.() } catch { /* */ }
    this.activeCleanup = null
  }

  private emit(type: string, payload: Record<string, unknown>): void {
    try {
      window.dispatchEvent(new CustomEvent("linkall:tutorial", {
        detail: { type, ...payload, step: this.steps[this.current] || null, progress: this.getProgress() },
      }))
    } catch { /* */ }
  }

  private findEl(selector: string): HTMLElement | null {
    if (!selector) return null
    try { return document.querySelector(selector) as HTMLElement | null } catch { return null }
  }

  private presentStep(): void {
    this.clearListeners()
    const step = this.steps[this.current]
    if (!step) return
    this.emit("step", {})

    if (step.action_type === "loop") {
      const key   = step.id || `loop-${this.current}`
      const count = (this.loopCounts[key] || 0) + 1
      this.loopCounts[key] = count
      return count <= (step.iterations || Infinity)
        ? this.next(step.next_step_id)
        : this.next(step.exit_step_id)
    }

    if (step.action_type === "condition") {
      let result = false
      try { if (step.condition) result = !!eval(step.condition) } catch { /* */ }
      return result ? this.next(step.next_step_id) : this.next(step.exit_step_id)
    }

    if (step.action_type === "wait") {
      const ms = step.value ? parseInt(step.value, 10) : 800
      const t  = window.setTimeout(() => this.next(), Number.isFinite(ms) ? ms : 800)
      this.activeCleanup = () => window.clearTimeout(t)
      return
    }

    if (step.action_type === "navigation") {
      if (typeof step.value === "string" && step.value.trim())
        window.location.href = step.value
      return
    }

    const el = this.findEl(step.selector)
    if (!el) { this.emit("missing_target", {}); return }

    this.highlighter.highlight(step.selector, this.color)

    if (step.action_type === "click") {
      const handler = () => this.next()
      el.addEventListener("click", handler, { once: true, capture: true })
      this.activeCleanup = () => el.removeEventListener("click", handler, { capture: true } as EventListenerOptions)
      return
    }

    if (step.action_type === "input") {
      const handler = () => {
        const val = (el as HTMLInputElement).value?.trim()
        if (val) this.next()
      }
      el.addEventListener("blur",   handler)
      el.addEventListener("change", handler)
      this.activeCleanup = () => {
        el.removeEventListener("blur",   handler)
        el.removeEventListener("change", handler)
      }
      return
    }
  }

  private async runAutopilot(): Promise<void> {
    while (this.running && this.current < this.steps.length) {
      const step = this.steps[this.current]
      this.emit("step", {})

      if (step.action_type === "wait") {
        const ms = step.value ? parseInt(step.value, 10) : 800
        await new Promise(r => setTimeout(r, Number.isFinite(ms) ? ms : 800))
        this.current += 1
        continue
      }

      if (step.action_type === "navigation") {
        if (typeof step.value === "string" && step.value.trim()) {
          window.location.href = step.value; return
        }
        this.current += 1; continue
      }

      this.highlighter.highlight(step.selector, this.color)
      const ok = this.executor.execute({
        action  : step.action_type === "input" ? "input" : "click",
        selector: step.selector,
        value   : step.value || undefined,
      })

      if (!ok) {
        this.emit("autopilot_failed", {})
        this.running = false
        this.highlighter.clear()
        return
      }

      await new Promise(r => setTimeout(r, 350))
      this.current += 1
    }
    if (this.running) this.complete()
  }
}

class OnboarderOverlay {
  private attr = "data-ob-overlay"
  private guideAttr = "data-ob-guide"

  clear(): void {
    document.querySelectorAll(`[${this.attr}]`).forEach((el) => el.remove())
  }

  clearGuide(): void {
    document.querySelectorAll(`[${this.guideAttr}]`).forEach((el) => el.remove())
    document.querySelectorAll("[data-ob-guide-card]").forEach((el) => el.remove())
  }

  /** Safely run querySelector with multiple fallback strategies */
  private qs(selector: string): Element | null {
    // 1. Direct try
    try {
      const el = document.querySelector(selector)
      if (el) return el
    } catch { /* invalid selector */ }

    // 2. If it was an ID selector (#foo), search by aria-label or text containing the concept
    if (selector.startsWith("#")) {
      const concept = selector.slice(1).replace(/-/g, " ").toLowerCase()
      // Try aria-label match
      const byAria = Array.from(document.querySelectorAll("[aria-label]")).find(
        el => el.getAttribute("aria-label")?.toLowerCase().includes(concept)
      )
      if (byAria) return byAria
      // Try text content match on buttons/links
      const byText = Array.from(document.querySelectorAll("button, a, [role='button']")).find(
        el => el.textContent?.trim().toLowerCase().includes(concept)
      )
      if (byText) return byText
    }

    // 3. Strip invalid chars (Tailwind) and try just the tag
    try {
      const tag = selector.split(/[.\[:#\s]/)[0] || "button"
      const el = document.querySelector(tag)
      if (el) return el
    } catch { /* ignore */ }

    return null
  }

  spotlight(selector: string): void {
    const el = this.qs(selector)
    console.log("[Onboarder] spotlight → selector:", selector, "→ el:", el)
    if (!el) return
    this.clear()
    el.scrollIntoView({ behavior: "smooth", block: "center" })
    setTimeout(() => {
      const rect = el.getBoundingClientRect()
      const overlay = document.createElement("div")
      overlay.setAttribute(this.attr, "spotlight")
      Object.assign(overlay.style, {
        position: "fixed", inset: "0", zIndex: "2147483640", pointerEvents: "none",
        background: "rgba(0,0,0,0.5)",
        clipPath: `polygon(0% 0%, 0% 100%, ${rect.left - 6}px 100%, ${rect.left - 6}px ${rect.top - 6}px, ${rect.right + 6}px ${rect.top - 6}px, ${rect.right + 6}px ${rect.bottom + 6}px, ${rect.left - 6}px ${rect.bottom + 6}px, ${rect.left - 6}px 100%, 100% 100%, 100% 0%)`,
        transition: "clip-path 0.3s ease",
      })
      document.body.appendChild(overlay)
      setTimeout(() => overlay.remove(), 8000)
    }, 400)
  }

  tooltip(selector: string, text: string): void {
    const el = this.qs(selector)
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "center" })
    setTimeout(() => {
      const rect = el.getBoundingClientRect()
      const tip = document.createElement("div")
      tip.setAttribute(this.attr, "tooltip")
      Object.assign(tip.style, {
        position: "fixed", top: `${rect.bottom + 10}px`, left: `${rect.left}px`,
        zIndex: "2147483641", background: "#1e293b", color: "#fff",
        padding: "8px 12px", borderRadius: "8px", fontSize: "12px", maxWidth: "240px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.2)", pointerEvents: "none",
      })
      tip.textContent = text
      document.body.appendChild(tip)
      setTimeout(() => tip.remove(), 6000)
    }, 400)
  }

  card(selector: string, data: { title?: string; body: string; cta_label?: string; cta_url?: string }): void {
    const el = this.qs(selector)
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "center" })

    setTimeout(() => {
      const rect = el.getBoundingClientRect()
      const card = document.createElement("div")
      card.setAttribute(this.attr, "card")
      Object.assign(card.style, {
        position: "fixed", top: `${rect.bottom + 12}px`, left: `${rect.left}px`,
        width: "320px", background: "#fff", borderRadius: "14px", padding: "18px",
        boxShadow: "0 12px 48px rgba(0,0,0,0.18)", zIndex: "2147483642",
        fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
        animation: "ob-fadein 0.2s ease"
      })

      if (data.title) {
        const h = document.createElement("div")
        h.textContent = data.title
        Object.assign(h.style, { fontWeight: "700", fontSize: "14px", marginBottom: "6px" })
        card.appendChild(h)
      }

      const b = document.createElement("div")
      b.textContent = data.body
      Object.assign(b.style, { fontSize: "13px", color: "#475569", lineHeight: "1.5", marginBottom: "16px" })
      card.appendChild(b)

      if (data.cta_label) {
        const btn = document.createElement("button")
        btn.textContent = data.cta_label
        Object.assign(btn.style, {
          width: "100%", padding: "10px", background: BRAND, color: "#fff",
          border: "none", borderRadius: "10px", cursor: "pointer", fontWeight: "600"
        })
        btn.onclick = () => {
          card.remove()
          if (data.cta_url) window.location.href = data.cta_url
        }
        card.appendChild(btn)
      }

      document.body.appendChild(card)
    }, 400)
  }

  pulse(selector: string): void {
    const el = this.qs(selector) as HTMLElement | null
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "center" })
    const orig = el.style.outline
    el.style.outline = `3px solid ${BRAND}`
    el.style.outlineOffset = "3px"
    el.style.transition = "outline 0.2s"
    let c = 0
    const iv = setInterval(() => {
      el.style.outline = c % 2 === 0 ? "none" : `3px solid ${BRAND}`
      if (++c > 6) { clearInterval(iv); el.style.outline = orig }
    }, 400)
  }

  /** Inject a full guide step overlay directly into document.body — bypasses React stacking context */
  showGuideStep(
    step     : GuideStep,
    color    : string,
    onNext   : () => void,
    onClose  : () => void,
    onBack?  : (() => void) | null,
    onReplay?: (() => void) | null,
  ): void {
    this.clearGuide()

    const d        = step.action_data
    const selector = d.selector as string | undefined
    const title    = (d.title  ?? step.message) as string
    const body     = (d.body   ?? step.message) as string
    const ctaLabel = (d.cta_label ?? (step.is_done ? "Terminer ✓" : "Suivant →")) as string
    const isNavigate = step.action_type === "navigate"
    const navUrl   = d.url as string | undefined

    // ── Helper: inject CSS keyframes once ────────────────────────────────
    if (!document.getElementById("ob-guide-styles")) {
      const s = document.createElement("style")
      s.id = "ob-guide-styles"
      s.textContent = `
        @keyframes ob-guide-in { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
        [data-ob-guide-card] { animation: ob-guide-in .2s ease }
      `
      document.head.appendChild(s)
    }

    const Z = "2147483647"

    // ── Dynamic spotlight via GuideHighlighter (tracks scroll/resize) ────────
    const highlighter = new GuideHighlighter()
    let   inputCleanup: (() => void) | null = null
    let   clickCleanup: (() => void) | null = null

    const hasSelector = !!selector && ["spotlight_card", "highlight", "spotlight", "tooltip",
                                        "hotspot", "click", "fill_input", "fill", "type"].includes(step.action_type)
    if (hasSelector) {
      const targetEl = this.qs(selector!)
      if (targetEl) {
        highlighter.highlight(selector!, color)

        // ── Auto-advance on CLICK (spotlight/click steps) ────────────────
        const isClickStep = ["spotlight_card", "highlight", "spotlight", "click", "hotspot"].includes(step.action_type)
        if (isClickStep) {
          const autoNext = (e?: Event) => {
            if (e instanceof KeyboardEvent && e.key !== "Enter") return
            // 800ms delay so the user sees the result before moving to next step
            setTimeout(() => { this.clearGuide(); highlighter.clear(); onNext() }, 800)
          }
          targetEl.addEventListener("click", autoNext, { once: true })
          clickCleanup = () => targetEl.removeEventListener("click", autoNext)
        }

        // ── Auto-advance on INPUT FILL (blur + non-empty value) ───────────
        const isInputStep = ["fill_input", "fill", "type"].includes(step.action_type)
        if (isInputStep && (targetEl instanceof HTMLInputElement || targetEl instanceof HTMLTextAreaElement)) {
          let advanced = false
          const autoFill = () => {
            if (advanced) return
            const val = (targetEl as HTMLInputElement).value?.trim()
            if (val) {
              advanced = true
              setTimeout(() => { this.clearGuide(); highlighter.clear(); onNext() }, 600)
            }
          }
          targetEl.addEventListener("blur",   autoFill)
          targetEl.addEventListener("change", autoFill)
          inputCleanup = () => {
            targetEl.removeEventListener("blur",   autoFill)
            targetEl.removeEventListener("change", autoFill)
          }
        }
      }
    }

    const spotlightCleanup = () => { highlighter.clear(); clickCleanup?.(); inputCleanup?.() }

    // ── Compact floating card — positionné en bas pour ne pas cacher la page ─
    const card = document.createElement("div")
    card.setAttribute("data-ob-guide-card", "")
    card.setAttribute(this.guideAttr, "card")

    // Position : en bas à droite par défaut (loin du centre de la page)
    Object.assign(card.style, {
      position: "fixed", zIndex: Z,
      bottom: "24px", right: "24px",
      width: "320px", maxWidth: "calc(100vw - 32px)",
      background: "#fff", borderRadius: "16px",
      boxShadow: "0 8px 32px rgba(0,0,0,.22), 0 0 0 1px rgba(0,0,0,.06)",
      padding: "16px 18px",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    // Pointer-events actifs uniquement sur la carte
    pointerEvents: "auto",
  })

  // Prevent clicks on the guide card from bubbling up (e.g. to page-level "click outside" listeners)
  card.addEventListener("click", (e) => e.stopPropagation())

    // ── Header: badge étape + bouton fermer ──────────────────────────────
    const header = document.createElement("div")
    Object.assign(header.style, {
      display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px",
    })

    const badge = document.createElement("span")
    badge.textContent = step.is_done ? "✓ Terminé" : `Étape ${step.step_num}`
    Object.assign(badge.style, {
      background: `${color}18`, color, borderRadius: "20px",
      padding: "2px 10px", fontSize: "11px", fontWeight: "600", letterSpacing: "0.3px",
    })
    header.appendChild(badge)

    const closeBtn = document.createElement("button")
    closeBtn.textContent = "✕"
    Object.assign(closeBtn.style, {
      background: "none", border: "none", cursor: "pointer",
      color: "#94a3b8", fontSize: "15px", lineHeight: "1", padding: "2px 4px",
    })
    closeBtn.addEventListener("click", () => { this.clearGuide(); spotlightCleanup?.(); onClose() })
    header.appendChild(closeBtn)
    card.appendChild(header)

    // ── Title ────────────────────────────────────────────────────────────
    if (title && title !== body) {
      const h = document.createElement("div")
      h.textContent = title
      Object.assign(h.style, { fontWeight: "700", fontSize: "14px", color: "#0f172a", marginBottom: "6px" })
      card.appendChild(h)
    }

    // ── Body ─────────────────────────────────────────────────────────────
    const p = document.createElement("div")
    p.textContent = body
    Object.assign(p.style, { fontSize: "13px", color: "#475569", lineHeight: "1.6", marginBottom: "14px" })
    card.appendChild(p)

    // ── Navigate hint ────────────────────────────────────────────────────
    if (isNavigate && navUrl) {
      const hint = document.createElement("div")
      Object.assign(hint.style, {
        background: `${color}12`, borderRadius: "8px",
        padding: "8px 12px", marginBottom: "12px",
        fontSize: "12px", color: "#334155",
      })
      hint.textContent = `→ ${navUrl}`
      card.appendChild(hint)
    }

    // ── Boutons CTA ───────────────────────────────────────────────────────
    if (!step.is_done) {
      // Ligne principale : ← Retour | Suivant →
      const row = document.createElement("div")
      Object.assign(row.style, { display: "flex", gap: "8px", marginBottom: onReplay ? "8px" : "0" })

      // Bouton Retour (si disponible)
      if (onBack) {
        const backBtn = document.createElement("button")
        backBtn.textContent = "← Retour"
        Object.assign(backBtn.style, {
          background: "none", border: `1px solid ${color}40`, borderRadius: "10px",
          cursor: "pointer", padding: "9px 12px",
          fontSize: "12px", color, fontFamily: "inherit", fontWeight: "500",
        })
        backBtn.addEventListener("click", () => { this.clearGuide(); spotlightCleanup?.(); onBack() })
        row.appendChild(backBtn)
      }

      // Bouton principal
      const cta = document.createElement("button")
      cta.textContent = ctaLabel
      Object.assign(cta.style, {
        flex: "1", background: color, color: "#fff",
        border: "none", borderRadius: "10px", cursor: "pointer",
        padding: "9px 14px", fontWeight: "600", fontSize: "13px",
        fontFamily: "inherit",
      })
      cta.addEventListener("click", () => {
        this.clearGuide()
        spotlightCleanup?.()
        if (isNavigate && navUrl) {
          window.location.href = navUrl
        } else {
          onNext()
        }
      })
      row.appendChild(cta)
      card.appendChild(row)

      // Ligne secondaire : Rejouer depuis le début | Arrêter
      const row2 = document.createElement("div")
      Object.assign(row2.style, { display: "flex", gap: "8px" })

      if (onReplay) {
        const replayBtn = document.createElement("button")
        replayBtn.textContent = "↺ Rejouer"
        Object.assign(replayBtn.style, {
          flex: "1", background: "none", border: "1px solid #e2e8f0",
          borderRadius: "10px", cursor: "pointer", padding: "7px 10px",
          fontSize: "12px", color: "#64748b", fontFamily: "inherit",
        })
        replayBtn.addEventListener("click", () => { this.clearGuide(); spotlightCleanup?.(); onReplay() })
        row2.appendChild(replayBtn)
      }

      const stopBtn = document.createElement("button")
      stopBtn.textContent = "Arrêter"
      Object.assign(stopBtn.style, {
        flex: "1", background: "none", border: "1px solid #e2e8f0",
        borderRadius: "10px", cursor: "pointer", padding: "7px 10px",
        fontSize: "12px", color: "#94a3b8", fontFamily: "inherit",
      })
      stopBtn.addEventListener("click", () => { this.clearGuide(); spotlightCleanup?.(); onClose() })
      row2.appendChild(stopBtn)

      if (row2.children.length) card.appendChild(row2)
    } else {
      // Done screen compact
      const doneRow = document.createElement("div")
      Object.assign(doneRow.style, { display: "flex", alignItems: "center", gap: "8px" })

      if (onReplay) {
        const replayBtn = document.createElement("button")
        replayBtn.textContent = "↺ Rejouer"
        Object.assign(replayBtn.style, {
          background: "none", border: `1px solid ${color}40`, borderRadius: "10px",
          cursor: "pointer", padding: "9px 12px",
          fontSize: "12px", color, fontFamily: "inherit", fontWeight: "500",
        })
        replayBtn.addEventListener("click", () => { this.clearGuide(); spotlightCleanup?.(); onReplay() })
        doneRow.appendChild(replayBtn)
      }

      const tick = document.createElement("span")
      tick.textContent = "🎉"
      Object.assign(tick.style, { fontSize: "20px" })
      doneRow.appendChild(tick)

      const doneBtn = document.createElement("button")
      doneBtn.textContent = "Fermer"
      Object.assign(doneBtn.style, {
        flex: "1", background: color, color: "#fff",
        border: "none", borderRadius: "10px", cursor: "pointer",
        padding: "9px 14px", fontWeight: "600", fontSize: "13px",
        fontFamily: "inherit",
      })
      doneBtn.addEventListener("click", () => { this.clearGuide(); spotlightCleanup?.(); onClose() })
      doneRow.appendChild(doneBtn)
      card.appendChild(doneRow)
    }

    document.body.appendChild(card)
  }
}

// ─── DOM capture ─────────────────────────────────────────────────────────────

function getSelector(el: Element): string {
  // Prefer stable, query-safe selectors in priority order
  if (el.id) return `#${CSS.escape(el.id)}`

  const testId = el.getAttribute("data-testid")
  if (testId) return `[data-testid="${testId}"]`

  const name = el.getAttribute("name")
  if (name) return `${el.tagName.toLowerCase()}[name="${name}"]`

  const aria = el.getAttribute("aria-label")
  if (aria) return `[aria-label="${aria}"]`

  // nth-child path — always valid, never contains Tailwind chars
  const tag    = el.tagName.toLowerCase()
  const parent = el.parentElement
  if (parent) {
    const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName)
    if (siblings.length === 1) {
      // unique tag under parent — use parent path
      const parentSel = getSelector(parent)
      return `${parentSel} > ${tag}`
    }
    const idx = siblings.indexOf(el) + 1
    const parentSel = getSelector(parent)
    return `${parentSel} > ${tag}:nth-of-type(${idx})`
  }
  return tag
}

function isInViewport(el: Element): boolean {
  const r = el.getBoundingClientRect()
  return r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth
}

function captureDom(): DomNode[] {
  const SELECTOR = 'button, a[href], input, textarea, select, h1, h2, h3, h4, [role="button"], [role="menuitem"], [aria-label], [role="dialog"], form, label'
  try {
    const seen = new Set<string>()
    const all = Array.from(document.querySelectorAll(SELECTOR))
      .filter(el => {
        if (el.closest("[data-ob-overlay]") || el.closest("[data-ob-guide]")) return false
        const h = el as HTMLElement
        const cs = window.getComputedStyle(h)
        if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") return false
        // For buttons/inputs, check if they have any size. For dialogs/containers, we might want them even if 0x0
        if (h.offsetWidth === 0 && h.offsetHeight === 0 && !["dialog", "form"].includes(h.getAttribute("role") || h.tagName.toLowerCase())) return false
        return true
      })

    // Sort to prioritize elements in modals or with high z-index
    const sorted = all.sort((a, b) => {
      const aInDialog = a.closest('[role="dialog"]') ? 1 : 0
      const bInDialog = b.closest('[role="dialog"]') ? 1 : 0
      if (aInDialog !== bInDialog) return bInDialog - aInDialog

      const az = parseInt(window.getComputedStyle(a).zIndex) || 0
      const bz = parseInt(window.getComputedStyle(b).zIndex) || 0
      return bz - az
    })

    return sorted
      .slice(0, 150) // Increased limit to capture more context
      .map(el => {
        const tag = el.tagName.toLowerCase()
        let type: DomNode["type"] = "text"
        if (tag === "button" || el.getAttribute("role") === "button" || el.getAttribute("role") === "menuitem") type = "button"
        else if (tag === "a") type = "link"
        else if (tag === "input" || tag === "textarea" || tag === "select") type = "input"
        else if (["h1","h2","h3","h4"].includes(tag)) type = "heading"
        else if (tag === "nav") type = "nav"
        else if (tag === "form") type = "form"
        else if (tag === "dialog" || el.getAttribute("role") === "dialog") type = "dialog"

        // Get the best text label — prefer aria-label, then direct text (not nested)
        const aria = el.getAttribute("aria-label")
        const directText = Array.from(el.childNodes)
          .filter(n => n.nodeType === Node.TEXT_NODE)
          .map(n => n.textContent?.trim())
          .filter(Boolean)
          .join(" ")
          .slice(0, 80)
        const fullText = el.textContent?.trim().slice(0, 80) ?? ""
        const label    = aria || directText || fullText

        const sel = getSelector(el)

        // Deduplicate by selector
        if (seen.has(sel)) return null
        seen.add(sel)

        const node: DomNode = {
          type,
          selector   : sel,
          in_viewport: isInViewport(el),
        }
        if (label)      node.text       = label
        if (aria)       node.aria_label = aria
        const ph = (el as HTMLInputElement).placeholder
        if (ph)         node.placeholder = ph
        const nm = el.getAttribute("name")
        if (nm)         node.name = nm
        const cls = el.className.toString().split(" ").filter(c => !c.match(/^[a-z]+-/) && c.length > 2).join(" ")
        if (cls)        node.classes = cls
        const href = (el as HTMLAnchorElement).href
        if (href && !href.startsWith("javascript")) node.href = href
        return node
      })
      .filter((n): n is DomNode => n !== null)
  } catch {
    return []
  }
}

/** Map DomNode[] to the { label, selector } format expected by the chat Edge Function */
function domToUiElements(nodes: DomNode[]): Array<{ label: string; selector: string; type: string }> {
  return nodes.map(n => ({
    type    : n.type,
    label   : n.text || n.aria_label || n.placeholder || n.type,
    selector: n.selector,
  }))
}

// ─── Token exchange ───────────────────────────────────────────────────────────

async function exchangeToken(token: string, onboarderUrl: string): Promise<BootstrapConfig> {
  const res = await fetch(`${onboarderUrl}/functions/v1/token-exchange`, {
    method : "POST",
    headers: { "Content-Type": "application/json" },
    body   : JSON.stringify({ token }),
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(`token-exchange failed: ${e.error ?? res.status}`)
  }
  return res.json() as Promise<BootstrapConfig>
}

// ─── Session ──────────────────────────────────────────────────────────────────

async function createSession(
  cfg       : BootstrapConfig,
  userId?   : string,
  userTraits?: Record<string, unknown>,
): Promise<string> {
  const res = await fetch(`${cfg.supabaseUrl}/rest/v1/onboarder_sessions`, {
    method : "POST",
    headers: {
      "Content-Type" : "application/json",
      "apikey"       : cfg.anonKey,
      "Authorization": `Bearer ${cfg.anonKey}`,
      "Prefer"       : "return=representation",
    },
    body: JSON.stringify({
      project_id   : cfg.projectId,
      user_id      : userId ?? null,
      user_traits  : userTraits ?? {},
      status       : "active",
      current_route: typeof window !== "undefined" ? window.location.pathname : "/",
      sdk_version  : "widget-1.2.0",
      locale       : cfg.projectConfig.locale ?? (typeof navigator !== "undefined" ? navigator.language : "en"),
    }),
  })
  if (!res.ok) throw new Error("Failed to create session")
  const [s] = await res.json() as Array<{ id: string }>
  return s.id
}

// ─── SSE streaming chat ───────────────────────────────────────────────────────

interface ChatResponseData {
  reply      : string
  confidence : number
  intent     : string
  actions    : unknown[]
  flow?      : ChatFlow | null
}

async function* streamChat(
  cfg       : BootstrapConfig,
  sessionId : string,
  question  : string,
  history   : Message[],
  domSnapshot: DomNode[],
  userTraits?: Record<string, unknown>,
): AsyncGenerator<{ type: "token"; text: string } | { type: "done"; data: ChatResponseData }> {
  const res = await fetch(`${cfg.supabaseUrl}/functions/v1/chat`, {
    method : "POST",
    headers: { "Content-Type": "application/json" },
    body   : JSON.stringify({
      question,
      projectId           : cfg.projectId,
      sessionId,
      uiContext: {
        currentRoute   : typeof window !== "undefined" ? window.location.pathname : "/",
        pageTitle      : typeof document !== "undefined" ? document.title : "",
        visibleElements: domToUiElements(domSnapshot),
      },
      userProfile         : userTraits ?? {},
      conversationHistory : history.map((m) => ({ role: m.role, content: m.content })),
    }),
  })
  if (!res.ok || !res.body) throw new Error(`Chat HTTP ${res.status}`)

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let   buffer  = ""
  let   event   = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""

    for (const line of lines) {
      if (line.startsWith("event: "))       { event = line.slice(7).trim(); continue }
      if (!line.startsWith("data: "))        continue
      const raw = line.slice(6)
      if (!raw || raw === "{}")              continue
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>
        if (event === "token" && typeof parsed.text === "string") {
          // The chat function sometimes sends the full JSON as a single token.
          // If so, extract just the reply field for display.
          const text = parsed.text as string
          let displayText = text
          if (text.trimStart().startsWith("{")) {
            try {
              const inner = JSON.parse(text) as Record<string, unknown>
              if (typeof inner.reply === "string") displayText = inner.reply
            } catch { /* partial JSON — show as-is */ }
          }
          yield { type: "token", text: displayText }
        } else if (event === "actions") {
          yield { type: "done", data: parsed as unknown as ChatResponseData }
        }
      } catch { /* partial */ }
    }
  }
}

// ─── Guide API calls ──────────────────────────────────────────────────────────

const LS_GUIDE_KEY = "ob_guide_session"

interface GuideSessionCache {
  guideSessionId: string
  objective      : string
  source         : "llm" | "library"
  flowSteps?     : GuideStep[]
  flowIdx?       : number
  stepHistory?   : StepRecord[]
}

function saveGuideSession(data: GuideSessionCache): void {
  try { localStorage.setItem(LS_GUIDE_KEY, JSON.stringify(data)) } catch {}
}
function loadGuideSession(): GuideSessionCache | null {
  try {
    const s = localStorage.getItem(LS_GUIDE_KEY)
    return s ? JSON.parse(s) as GuideSessionCache : null
  } catch { return null }
}
function clearGuideSession(): void {
  try { localStorage.removeItem(LS_GUIDE_KEY) } catch {}
}

async function callGuideStart(
  cfg       : BootstrapConfig,
  sessionId : string,
  objective : string,
  dom       : DomNode[],
  route     : string,
  locale    : string,
): Promise<{ source: "llm" | "library"; guide_session_id: string; step?: GuideStep; flow?: { id: string; name: string; steps: GuideStep[] } }> {
  const res = await fetch(`${cfg.supabaseUrl}/functions/v1/guide-start`, {
    method : "POST",
    headers: { "Content-Type": "application/json", "apikey": cfg.anonKey, "Authorization": `Bearer ${cfg.anonKey}` },
    body   : JSON.stringify({
      project_id  : cfg.projectId,
      session_id  : sessionId,
      objective,
      dom_snapshot: dom,
      route,
      locale,
    }),
  })
  if (!res.ok) throw new Error(`guide-start ${res.status}`)
  return res.json()
}

async function callGuideNext(
  cfg            : BootstrapConfig,
  guideSessionId : string,
  completedStep  : GuideStep,
  dom            : DomNode[],
  route          : string,
  locale         : string,
  stepHistory?   : StepRecord[],
): Promise<{ step: GuideStep | null; is_done: boolean }> {
  const res = await fetch(`${cfg.supabaseUrl}/functions/v1/guide-next`, {
    method : "POST",
    headers: { "Content-Type": "application/json", "apikey": cfg.anonKey, "Authorization": `Bearer ${cfg.anonKey}` },
    body   : JSON.stringify({
      guide_session_id: guideSessionId,
      completed_step  : completedStep,
      dom_snapshot    : dom,
      route,
      locale,
      step_history    : stepHistory ?? [],
    }),
  })
  if (!res.ok) throw new Error(`guide-next ${res.status}`)
  return res.json()
}

async function callGuideComplete(
  cfg            : BootstrapConfig,
  guideSessionId : string,
): Promise<void> {
  try {
    await fetch(`${cfg.supabaseUrl}/functions/v1/guide-complete`, {
      method : "POST",
      headers: { "Content-Type": "application/json", "apikey": cfg.anonKey, "Authorization": `Bearer ${cfg.anonKey}` },
      body   : JSON.stringify({ guide_session_id: guideSessionId }),
    })
  } catch { /* fire-and-forget */ }
}

// ─── Inline styles helper (no Tailwind dependency) ───────────────────────────

function hex2rgba(hex: string, alpha: number): string {
  try {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r},${g},${b},${alpha})`
  } catch {
    return `rgba(99,102,241,${alpha})`
  }
}

// ─── Guide overlays ───────────────────────────────────────────────────────────

interface OverlayProps {
  step    : GuideStep
  onNext  : () => void
  onClose : () => void
  color   : string
  gradient: string
}

function InfoModalOverlay({ step, onNext, onClose, color, gradient }: OverlayProps) {
  const d = step.action_data
  return (
    <div data-onboarder style={{
      position: "fixed", inset: 0, zIndex: 2147483500,
      background: "rgba(0,0,0,.55)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: "#fff", borderRadius: 20,
        boxShadow: "0 20px 60px rgba(0,0,0,.35)",
        padding: 28, maxWidth: 400, width: "calc(100vw - 48px)",
        animation: "ob-fadein .18s ease",
      }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Step indicator */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{
            background: hex2rgba(color, .12), color,
            borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 600,
          }}>
            Étape {step.step_num}
          </span>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "#94a3b8", fontSize: 18, lineHeight: 1, padding: 4,
          }}>✕</button>
        </div>

        {d.title && (
          <div style={{ fontWeight: 700, fontSize: 17, color: "#0f172a", marginBottom: 10 }}>
            {String(d.title)}
          </div>
        )}
        <div style={{ fontSize: 14, color: "#475569", lineHeight: 1.7, marginBottom: 20 }}>
          {String(d.body ?? step.message)}
        </div>

        {step.action_type === "navigate" && d.url && (
          <div style={{
            background: hex2rgba(color, .08), borderRadius: 10,
            padding: "10px 14px", marginBottom: 16, fontSize: 13,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontSize: 16 }}>→</span>
            <span style={{ color: "#334155" }}>Naviguer vers <strong style={{ color }}>{String(d.url)}</strong></span>
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onNext} style={{
            flex: 1, background: gradient, color: "#fff",
            border: "none", borderRadius: 12, cursor: "pointer",
            padding: "11px 20px", fontWeight: 600, fontSize: 14,
            fontFamily: "inherit",
          }}>
            {String(d.cta_label ?? (step.is_done ? "Terminer" : "Suivant →"))}
          </button>
        </div>
      </div>
    </div>
  )
}

function SpotlightOverlay({ step, onNext, onClose, color, gradient }: OverlayProps) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const d = step.action_data

  useEffect(() => {
    const selector = d.selector as string | undefined
    if (!selector) return
    const el = (() => { try { return document.querySelector(selector) as HTMLElement } catch { return null } })()
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      setTimeout(() => {
        setRect(el.getBoundingClientRect())
      }, 350)

      const autoNext = (e?: any) => {
        if (e?.key && e.key !== "Enter") return
        setTimeout(onNext, 1000)
      }
      el.addEventListener("click", autoNext)
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.addEventListener("keydown", autoNext)
      }
      return () => {
        el.removeEventListener("click", autoNext)
        el.removeEventListener("keydown", autoNext)
      }
    }
  }, [d.selector, onNext])

  const PAD = 10
  const cardLeft  = rect ? Math.max(8, Math.min(rect.left, window.innerWidth - 340)) : window.innerWidth / 2 - 160
  const cardTop   = rect
    ? (rect.bottom + 16 + 220 > window.innerHeight ? rect.top - 220 - 16 : rect.bottom + 16)
    : window.innerHeight / 2 - 110

  return (
    <div data-onboarder style={{ position: "fixed", inset: 0, zIndex: 2147483500, pointerEvents: "none" }}>
      {/* Dark backdrop */}
      <div style={{
        position: "absolute", inset: 0,
        background: "rgba(0,0,0,.6)",
        pointerEvents: "auto",
      }} onClick={onClose} />

      {/* Spotlight cutout */}
      {rect && (
        <div style={{
          position: "absolute",
          left  : rect.left   - PAD,
          top   : rect.top    - PAD,
          width : rect.width  + PAD * 2,
          height: rect.height + PAD * 2,
          borderRadius: 10,
          boxShadow: "0 0 0 9999px transparent",
          background: "transparent",
          outline: `3px solid ${color}`,
          outlineOffset: 2,
          pointerEvents: "none",
          zIndex: 1,
        }} />
      )}

      {/* Floating card */}
      <div style={{
        position: "absolute",
        left    : cardLeft,
        top     : cardTop,
        width   : 320,
        background: "#fff",
        borderRadius: 16,
        boxShadow: "0 12px 48px rgba(0,0,0,.35)",
        padding: 20,
        zIndex  : 2,
        pointerEvents: "auto",
        fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
        animation: "ob-fadein .18s ease",
      }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <span style={{
            background: hex2rgba(color, .12), color,
            borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 600,
          }}>
            Étape {step.step_num}
          </span>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "#94a3b8", fontSize: 16, padding: 2,
          }}>✕</button>
        </div>

        {d.title && (
          <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", marginBottom: 6 }}>
            {String(d.title)}
          </div>
        )}
        <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.65, marginBottom: 16 }}>
          {String(d.body ?? step.message)}
        </div>

        <button onClick={onNext} style={{
          width: "100%", background: gradient, color: "#fff",
          border: "none", borderRadius: 10, cursor: "pointer",
          padding: "10px 16px", fontWeight: 600, fontSize: 13,
          fontFamily: "inherit",
        }}>
          {String(d.cta_label ?? (step.is_done ? "Terminer ✓" : "Suivant →"))}
        </button>
      </div>
    </div>
  )
}

function TooltipOverlay({ step, onNext, onClose, color, gradient }: OverlayProps) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const d = step.action_data

  useEffect(() => {
    const selector = d.selector as string | undefined
    if (!selector) return
    const el = (() => { try { return document.querySelector(selector) as HTMLElement } catch { return null } })()
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      setTimeout(() => setRect(el.getBoundingClientRect()), 350)

      const autoNext = (e?: any) => {
        if (e?.key && e.key !== "Enter") return
        setTimeout(onNext, 1000)
      }
      el.addEventListener("click", autoNext)
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.addEventListener("keydown", autoNext)
      }
      return () => {
        el.removeEventListener("click", autoNext)
        el.removeEventListener("keydown", autoNext)
      }
    }
  }, [d.selector, onNext])

  if (!rect) return null

  const above = rect.bottom + 90 > window.innerHeight
  const left  = Math.max(8, Math.min(rect.left, window.innerWidth - 260))

  return (
    <div data-onboarder style={{
      position: "fixed",
      left : left,
      top  : above ? rect.top - 80 - 8 : rect.bottom + 8,
      width: 250,
      zIndex: 2147483502,
      background: "#1e293b",
      color: "#f1f5f9",
      borderRadius: 10,
      padding: "10px 14px",
      fontSize: 13,
      lineHeight: 1.6,
      boxShadow: "0 8px 24px rgba(0,0,0,.4)",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      animation: "ob-fadein .15s ease",
    }}>
      {String(d.text ?? step.message)}
      <button onClick={onNext} style={{
        display: "block", marginTop: 8, background: color,
        color: "#fff", border: "none", borderRadius: 6, cursor: "pointer",
        padding: "4px 12px", fontSize: 12, fontFamily: "inherit",
      }}>
        {String(d.cta_label ?? "OK")}
      </button>
      {/* Arrow */}
      <div style={{
        position: "absolute",
        [above ? "bottom" : "top"]: -6,
        left: 20,
        width: 12, height: 6,
        background: "#1e293b",
        clipPath: above ? "polygon(0 0,100% 0,50% 100%)" : "polygon(50% 0,0 100%,100% 100%)",
      }} />
    </div>
  )
}

function HotspotOverlay({ step, onNext, onClose, color, gradient }: OverlayProps) {
  // hotspot_group: action_data is an array of {selector, title, body}
  const items = Array.isArray(step.action_data)
    ? step.action_data as Array<{selector: string; title?: string; body?: string}>
    : step.action_data.selector
      ? [step.action_data as {selector: string; title?: string; body?: string}]
      : []

  const [rects, setRects] = useState<Array<DOMRect | null>>([])
  useEffect(() => {
    const rs = items.map(item => {
      const el = document.querySelector(item.selector)
      return el ? el.getBoundingClientRect() : null
    })
    setRects(rs)

    const els: HTMLElement[] = []
    const autoNext = (e?: any) => {
      if (e?.key && e.key !== "Enter") return
      setTimeout(onNext, 1000)
    }

    items.forEach(item => {
      const el = document.querySelector(item.selector) as HTMLElement
      if (el) {
        el.addEventListener("click", autoNext)
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          el.addEventListener("keydown", autoNext)
        }
        els.push(el)
      }
    })

    return () => {
      els.forEach(el => {
        el.removeEventListener("click", autoNext)
        el.removeEventListener("keydown", autoNext)
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onNext])

  return (
    <div data-onboarder style={{ position: "fixed", inset: 0, zIndex: 2147483500, pointerEvents: "none" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.5)", pointerEvents: "auto" }} onClick={onClose} />
      {items.map((item, i) => {
        const r = rects[i]
        if (!r) return null
        return (
          <div key={i} style={{
            position: "absolute",
            left: r.left + r.width / 2 - 12,
            top : r.top  + r.height / 2 - 12,
            width: 24, height: 24,
            borderRadius: "50%",
            background: color,
            border: `3px solid #fff`,
            boxShadow: `0 0 0 4px ${hex2rgba(color, .3)}`,
            pointerEvents: "none",
            zIndex: 1,
            animation: "ob-pulse 2s ease-in-out infinite",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 12, fontWeight: 700,
          }}>
            {i + 1}
          </div>
        )
      })}
      {/* Summary card */}
      <div style={{
        position: "absolute", bottom: 80, left: "50%", transform: "translateX(-50%)",
        width: 340, background: "#fff", borderRadius: 16,
        boxShadow: "0 12px 48px rgba(0,0,0,.35)",
        padding: 20, zIndex: 2, pointerEvents: "auto",
        fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
        animation: "ob-fadein .18s ease",
      }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 13, color: "#475569", marginBottom: 14 }}>{step.message}</div>
        <button onClick={onNext} style={{
          width: "100%", background: gradient, color: "#fff",
          border: "none", borderRadius: 10, cursor: "pointer",
          padding: "10px", fontWeight: 600, fontSize: 13, fontFamily: "inherit",
        }}>
          Suivant →
        </button>
      </div>
    </div>
  )
}

function DoneOverlay({ onClose, color }: { onClose: () => void; color: string }) {
  return (
    <div data-onboarder style={{
      position: "fixed", inset: 0, zIndex: 2147483500,
      background: "rgba(0,0,0,.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    }}>
      <div style={{
        background: "#fff", borderRadius: 20,
        padding: 32, maxWidth: 360, width: "calc(100vw - 48px)",
        textAlign: "center",
        boxShadow: "0 20px 60px rgba(0,0,0,.35)",
        animation: "ob-fadein .2s ease",
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
        <div style={{ fontWeight: 700, fontSize: 20, color: "#0f172a", marginBottom: 8 }}>
          Terminé !
        </div>
        <div style={{ fontSize: 14, color: "#64748b", marginBottom: 24 }}>
          Vous avez complété toutes les étapes.
        </div>
        <button onClick={onClose} style={{
          background: color, color: "#fff",
          border: "none", borderRadius: 12, cursor: "pointer",
          padding: "11px 32px", fontWeight: 600, fontSize: 14, fontFamily: "inherit",
        }}>
          Fermer
        </button>
      </div>
    </div>
  )
}

function GuideOverlay({ step, onNext, onClose, color, gradient }: OverlayProps) {
  if (step.is_done) return <DoneOverlay onClose={onClose} color={color} />

  switch (step.action_type) {
    case "spotlight_card":
    case "highlight":
      return <SpotlightOverlay step={step} onNext={onNext} onClose={onClose} color={color} gradient={gradient} />
    case "tooltip":
      return <TooltipOverlay step={step} onNext={onNext} onClose={onClose} color={color} gradient={gradient} />
    case "hotspot":
    case "hotspot_group":
      return <HotspotOverlay step={step} onNext={onNext} onClose={onClose} color={color} gradient={gradient} />
    case "navigate":
    case "info_modal":
    case "banner":
    default:
      return <InfoModalOverlay step={step} onNext={onNext} onClose={onClose} color={color} gradient={gradient} />
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: "50%",
          background: "#94a3b8",
          animation: `ob-bounce 1.2s ${i * 0.2}s ease-in-out infinite`,
        }} />
      ))}
    </span>
  )
}

function Avatar({ emoji, avatarUrl, color, size = 32 }: {
  emoji?: string; avatarUrl?: string; color: string; size?: number
}) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: hex2rgba(color, 0.15),
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.5, overflow: "hidden",
    }}>
      {avatarUrl
        ? <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : (emoji ?? "🤖")}
    </div>
  )
}

// Progress pill shown during guide mode
function GuidePill({ stepNum, isLoading, color, gradient, onStop }: {
  stepNum: number; isLoading: boolean; color: string; gradient: string; onStop: () => void
}) {
  return (
    <div data-onboarder style={{
      position: "fixed", bottom: 96, left: "50%", transform: "translateX(-50%)",
      zIndex: 2147483498,
      background: "#fff",
      border: `2px solid ${color}`,
      borderRadius: 100,
      boxShadow: "0 4px 20px rgba(0,0,0,.18)",
      padding: "6px 16px",
      display: "flex", alignItems: "center", gap: 10,
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      fontSize: 13,
      animation: "ob-fadein .2s ease",
    }}>
      {isLoading
        ? <span style={{ display: "inline-flex", gap: 3 }}>
            {[0,1,2].map(i => (
              <span key={i} style={{
                width: 5, height: 5, borderRadius: "50%", background: color,
                animation: `ob-bounce 1.2s ${i*.2}s ease-in-out infinite`,
              }} />
            ))}
          </span>
        : <span style={{
            background: gradient, color: "#fff",
            borderRadius: "50%", width: 20, height: 20,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700,
          }}>{stepNum}</span>
      }
      <span style={{ color: "#334155", fontWeight: 500 }}>
        {isLoading ? "Analyse de la page…" : `Étape ${stepNum} en cours`}
      </span>
      <button onClick={onStop} style={{
        background: "none", border: "none", cursor: "pointer",
        color: "#94a3b8", fontSize: 12, padding: "2px 4px",
      }}>✕</button>
    </div>
  )
}

// ─── Main widget ─────────────────────────────────────────────────────────────

export function OnboarderWidget({
  token,
  onboarderUrl,
  userId,
  userTraits,
}: OnboarderWidgetProps) {
  const [boot,      setBoot]      = useState<BootstrapConfig | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages,  setMessages]  = useState<Message[]>([])
  const [input,     setInput]     = useState("")
  const [open,      setOpen]      = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [sending,   setSending]   = useState(false)
  const [unread,    setUnread]    = useState(0)
  const [error,     setError]     = useState<string | null>(null)

  // Guide mode state
  const [activeStep,      setActiveStep]      = useState<GuideStep | null>(null)
  const [stepHistory,     setStepHistory]     = useState<StepRecord[]>([])
  const [guideObjective,  setGuideObjective]  = useState("")
  const [guideLoading,    setGuideLoading]    = useState(false)
  const [guideSessionId,  setGuideSessionId]  = useState<string | null>(null)
  const [guideSource,     setGuideSource]     = useState<"llm" | "library" | null>(null)
  // Pre-built flow steps (library source or chat flow)
  const [flowSteps,       setFlowSteps]       = useState<GuideStep[]>([])
  const [flowIdx,         setFlowIdx]         = useState(0)

  const guideSessionIdRef = useRef<string | null>(null)
  const guideSourceRef    = useRef<"llm" | "library" | null>(null)
  // Cache des GuideStep précédents pour pouvoir revenir en arrière
  const [stepCache,       setStepCache]       = useState<GuideStep[]>([])

  const bootRef         = useRef<BootstrapConfig | null>(null)
  const sessionRef      = useRef<string | null>(null)
  const messagesRef     = useRef<Message[]>([])
  const endRef          = useRef<HTMLDivElement>(null)
  const inputRef        = useRef<HTMLInputElement>(null)
  const overlayRef      = useRef<OnboarderOverlay | null>(null)
  const advanceGuideRef = useRef<(() => void) | null>(null)
  const stopGuideRef    = useRef<(() => void) | null>(null)
  const goBackRef       = useRef<(() => void) | null>(null)
  const replayGuideRef  = useRef<(() => void) | null>(null)

  if (typeof window !== "undefined" && !overlayRef.current) {
    overlayRef.current = new OnboarderOverlay()
  }

  // Keep refs in sync
  useEffect(() => { messagesRef.current = messages }, [messages])

  // ── Bootstrap: token exchange + session ──────────────────────────────
  useEffect(() => {
    if (!token || !onboarderUrl) return
    let cancelled = false

    exchangeToken(token, onboarderUrl)
      .then(async (b) => {
        if (cancelled) return
        bootRef.current = b
        setBoot(b)
        const sid = await createSession(b, userId, userTraits)
        if (cancelled) return
        sessionRef.current = sid
        setSessionId(sid)
        const cfg = b.projectConfig
        const welcome = cfg.welcomeMessage
          ?? `Bonjour ! Je suis ${cfg.agentName ?? "votre assistant"}. Comment puis-je vous aider ?`
        setMessages([{ role: "assistant", content: welcome }])

        // (resume handled in a separate effect keyed on sessionId)
      })
      .catch((e) => { if (!cancelled) setError(String(e)) })

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, onboarderUrl])

  // ── Auto-scroll ───────────────────────────────────────────────────────
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // ── Focus input on open ───────────────────────────────────────────────
  useEffect(() => {
    if (open && !minimized) setTimeout(() => inputRef.current?.focus(), 150)
  }, [open, minimized])

  // ── Render guide overlay imperatively whenever activeStep changes ──────
  useEffect(() => {
    if (!activeStep || typeof window === "undefined") return

    const cfg   = bootRef.current
    const color = cfg?.projectConfig?.primaryColor ?? "#6366f1"

    overlayRef.current?.showGuideStep(
      activeStep,
      color,
      () => advanceGuideRef.current?.(),              // onNext
      () => stopGuideRef.current?.(),                 // onClose
      goBackRef.current ? () => goBackRef.current?.() : null,    // onBack
      replayGuideRef.current ? () => replayGuideRef.current?.() : null, // onReplay
    )

    return () => {
      // When activeStep becomes null (stopped/done), clear overlay
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep])

  // ── Start guide — toujours progressif via guide-start (KB + DOM + manifest) ─
  const startGuide = useCallback(async (objective: string) => {
    if (!bootRef.current || !sessionRef.current) return
    setGuideObjective(objective)
    setStepHistory([])
    setStepCache([])
    setFlowSteps([])
    setFlowIdx(0)
    setGuideLoading(true)

    try {
      const cfg    = bootRef.current
      const sid    = sessionRef.current
      const locale = cfg.projectConfig.locale ?? "fr"
      const route  = typeof window !== "undefined" ? window.location.pathname : "/"

      // Toujours appeler guide-start — il check la library ET génère via KB+manifest+DOM
      const dom = captureDom()
      const res = await callGuideStart(cfg, sid, objective, dom, route, locale)

      setGuideSessionId(res.guide_session_id)
      guideSessionIdRef.current = res.guide_session_id
      setGuideSource(res.source)
      guideSourceRef.current = res.source

      if (res.source === "library" && res.flow?.steps?.length) {
        // Library hit — run pre-built flow
        const steps = res.flow.steps as GuideStep[]
        setFlowSteps(steps)
        setFlowIdx(0)
        setActiveStep(steps[0])
        saveGuideSession({
          guideSessionId: res.guide_session_id,
          objective,
          source   : "library",
          flowSteps: steps,
          flowIdx  : 0,
        })
        setMessages(prev => [...prev, {
          role    : "assistant",
          content : `Procédure retrouvée (${steps.length} étapes).`,
          guideStep: 1,
        }])
      } else if (res.step) {
        // LLM generated first step
        setActiveStep(res.step)
        saveGuideSession({
          guideSessionId: res.guide_session_id,
          objective,
          source : "llm",
          stepHistory: [],
        })
        setMessages(prev => [...prev, {
          role    : "assistant",
          content : `Je commence le guidage. Étape ${res.step!.step_num} →`,
          guideStep: res.step!.step_num,
        }])
      }
    } catch {
      setMessages(prev => [...prev, {
        role   : "assistant",
        content: "Impossible de démarrer le guidage. Veuillez réessayer.",
      }])
    } finally {
      setGuideLoading(false)
    }
  }, [])

  // ── Resume guide from localStorage after page navigation ─────────────
  const resumeGuideIfNeeded = useCallback(() => {
    if (!bootRef.current || !sessionRef.current) return
    const cached = loadGuideSession()
    if (!cached) return

    setGuideSessionId(cached.guideSessionId)
    guideSessionIdRef.current = cached.guideSessionId
    setGuideObjective(cached.objective)
    setGuideSource(cached.source)
    guideSourceRef.current = cached.source

    if (cached.source === "library" && cached.flowSteps?.length) {
      const idx = cached.flowIdx ?? 0
      setFlowSteps(cached.flowSteps)
      setFlowIdx(idx)
      setActiveStep(cached.flowSteps[idx])
    } else if (cached.source === "llm") {
      const history = cached.stepHistory ?? []
      setStepHistory(history)
      // Re-fetch next step for the new page
      const cfg    = bootRef.current!
      const sid    = sessionRef.current!
      const locale = cfg.projectConfig.locale ?? "fr"
      const route  = typeof window !== "undefined" ? window.location.pathname : "/"
      setGuideLoading(true)
      // Simulate a "next" call with a fake completed dummy step to continue
      // Actually: just re-call guide-next with the last completed step if any
      // If no history, we can't resume gracefully — just clear
      if (history.length === 0) { clearGuideSession(); return }

      const lastStep = history[history.length - 1]
      const fakeStep: GuideStep = {
        message    : lastStep.message,
        action_type: lastStep.action_type,
        action_data: { selector: lastStep.selector },
        is_done    : false,
        step_num   : lastStep.step_num,
      }
      const dom = captureDom()
      callGuideNext(cfg, cached.guideSessionId, fakeStep, dom, route, locale)
        .then(r => {
          if (r.is_done || !r.step) {
            callGuideComplete(cfg, cached.guideSessionId)
            clearGuideSession()
          } else {
            setActiveStep(r.step)
          }
        })
        .catch(() => clearGuideSession())
        .finally(() => setGuideLoading(false))
    }
  }, [])

  // ── startFlowGuide : ignore le flow pré-construit, démarre progressivement
  const startFlowGuide = useCallback((_flow: ChatFlow, objective: string) => {
    startGuide(objective)
  }, [startGuide])

  // ── Resume guide after page navigation (runs when session is ready) ───
  useEffect(() => {
    if (!sessionId) return
    const t = setTimeout(() => resumeGuideIfNeeded(), 500)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // ── Advance guide to next step ────────────────────────────────────────
  const advanceGuide = useCallback(async () => {
    if (!activeStep) return

    overlayRef.current?.clearGuide()

    // Done screen dismissed — finalize
    if (activeStep.is_done) {
      const gsid = guideSessionIdRef.current
      const src  = guideSourceRef.current
      if (gsid && src === "llm" && bootRef.current) {
        callGuideComplete(bootRef.current, gsid)
      }
      clearGuideSession()
      setActiveStep(null)
      setFlowSteps([])
      setFlowIdx(0)
      setStepHistory([])
      setGuideObjective("")
      setGuideSessionId(null)
      setGuideSource(null)
      return
    }

    // ── Pre-built flow / library mode ────────────────────────────────────
    if (flowSteps.length > 0) {
      setStepCache(c => [...c, activeStep])  // save for back navigation
      const nextIdx = flowIdx + 1
      if (nextIdx >= flowSteps.length) {
        // All flow steps done
        const gsid = guideSessionIdRef.current
        if (gsid && bootRef.current) callGuideComplete(bootRef.current, gsid)
        clearGuideSession()
        setActiveStep({ ...activeStep, is_done: true, message: "Objectif atteint !" })
      } else {
        const nextStep = flowSteps[nextIdx]
        setFlowIdx(nextIdx)
        setActiveStep(nextStep)
        // Update localStorage with new index
        const gsid = guideSessionIdRef.current
        if (gsid) {
          saveGuideSession({
            guideSessionId: gsid,
            objective: guideObjective,
            source   : "library",
            flowSteps,
            flowIdx  : nextIdx,
          })
        }
      }
      return
    }

    // ── LLM DOM-adaptive mode — call guide-next ───────────────────────────
    if (!bootRef.current) return

    setStepCache(c => [...c, activeStep])  // save for back navigation

    const record: StepRecord = {
      step_num   : activeStep.step_num,
      message    : activeStep.message,
      action_type: activeStep.action_type,
      selector   : activeStep.action_data?.selector as string | undefined,
      route      : window.location.pathname,
      done_at    : new Date().toISOString(),
    }
    const newHistory = [...stepHistory, record]
    setStepHistory(newHistory)
    setActiveStep(null)
    setGuideLoading(true)

    try {
      const cfg    = bootRef.current!
      const locale = cfg.projectConfig.locale ?? "fr"
      const route  = window.location.pathname
      const dom    = captureDom()
      const gsid   = guideSessionIdRef.current!

      const res = await callGuideNext(cfg, gsid, activeStep, dom, route, locale, newHistory)

      if (res.is_done || !res.step) {
        // Complete
        callGuideComplete(cfg, gsid)
        clearGuideSession()
        setActiveStep({ ...activeStep, is_done: true, step_num: activeStep.step_num + 1, message: "Objectif atteint !" })
        setStepHistory([])
        setGuideObjective("")
        setGuideSessionId(null)
        setGuideSource(null)
      } else {
        setActiveStep(res.step)
        // Persist updated history for cross-page resume
        saveGuideSession({
          guideSessionId: gsid,
          objective: guideObjective,
          source   : "llm",
          stepHistory: newHistory,
        })
      }
    } catch {
      setMessages(prev => [...prev, {
        role   : "assistant",
        content: "Une erreur est survenue lors du guidage.",
      }])
      clearGuideSession()
      setStepHistory([])
      setGuideObjective("")
      setGuideSessionId(null)
      setGuideSource(null)
    } finally {
      setGuideLoading(false)
    }
  }, [activeStep, flowSteps, flowIdx, stepHistory, guideObjective])

  // ── Go back to previous step ─────────────────────────────────────────
  const goBack = useCallback(() => {
    if (stepCache.length === 0) return
    overlayRef.current?.clearGuide()
    const prev      = stepCache[stepCache.length - 1]
    const newCache  = stepCache.slice(0, -1)
    setStepCache(newCache)
    setActiveStep(prev)
    // Revert stepHistory too
    setStepHistory(h => h.slice(0, -1))
    // Revert flowIdx if in flow mode
    if (flowSteps.length > 0) {
      setFlowIdx(i => Math.max(0, i - 1))
    }
  }, [stepCache, flowSteps])

  // ── Replay from the beginning ─────────────────────────────────────────
  const replayGuide = useCallback(async () => {
    overlayRef.current?.clearGuide()
    setStepCache([])
    setStepHistory([])

    // Toujours relancer guide-start pour recapturer le DOM actuel + KB
    if (!bootRef.current || !sessionRef.current || !guideObjective) return
    setActiveStep(null)
    setGuideLoading(true)
    try {
      const cfg    = bootRef.current
      const sid    = sessionRef.current
      const locale = cfg.projectConfig.locale ?? "fr"
      const route  = typeof window !== "undefined" ? window.location.pathname : "/"
      const dom    = captureDom()
      const res    = await callGuideStart(cfg, sid, guideObjective, dom, route, locale)
      setGuideSessionId(res.guide_session_id)
      guideSessionIdRef.current = res.guide_session_id
      setGuideSource(res.source)
      guideSourceRef.current = res.source
      if (res.source === "library" && res.flow?.steps?.length) {
        const steps = res.flow.steps as GuideStep[]
        setFlowSteps(steps)
        setFlowIdx(0)
        setActiveStep(steps[0])
      } else if (res.step) {
        setActiveStep(res.step)
      }
    } catch { /* silent */ } finally {
      setGuideLoading(false)
    }
  }, [flowSteps, guideObjective])

  // ── Stop guide (user-initiated abandon) ──────────────────────────────
  const stopGuide = useCallback(() => {
    overlayRef.current?.clearGuide()
    clearGuideSession()
    setActiveStep(null)
    setStepHistory([])
    setStepCache([])
    setGuideObjective("")
    setGuideLoading(false)
    setFlowSteps([])
    setFlowIdx(0)
    setGuideSessionId(null)
    setGuideSource(null)
  }, [])

  // Keep stable refs for DOM callbacks (avoid stale closures in showGuideStep)
  useEffect(() => { advanceGuideRef.current  = advanceGuide    }, [advanceGuide])
  useEffect(() => { stopGuideRef.current     = stopGuide       }, [stopGuide])
  useEffect(() => { goBackRef.current        = stepCache.length > 0 ? goBack : null }, [goBack, stepCache])
  useEffect(() => { replayGuideRef.current   = replayGuide     }, [replayGuide])
  useEffect(() => { guideSessionIdRef.current = guideSessionId }, [guideSessionId])
  useEffect(() => { guideSourceRef.current    = guideSource    }, [guideSource])

  // ── Send ──────────────────────────────────────────────────────────────
  const send = useCallback(async () => {
    const q = input.trim()
    if (!q || sending || !bootRef.current || !sessionRef.current) return

    setInput("")
    const userMsg: Message = { role: "user", content: q }
    setMessages((prev) => [...prev, userMsg, { role: "assistant", content: "", streaming: true }])
    setSending(true)

    // Capture DOM snapshot
    const domSnapshot = captureDom()
    console.log("[Onboarder] DOM snapshot sent to LLM:", domSnapshot.map(n => `${n.type} sel="${n.selector}" text="${n.text ?? ""}" aria="${n.aria_label ?? ""}"`))
    let finalData: ChatResponseData | null = null

    try {
      let fullText = ""

      for await (const chunk of streamChat(
        bootRef.current,
        sessionRef.current,
        q,
        [...messagesRef.current, userMsg],
        domSnapshot,
        userTraits,
      )) {
        if (chunk.type === "token") {
          fullText += chunk.text
          setMessages((prev) => {
            const next = [...prev]
            next[next.length - 1] = { role: "assistant", content: fullText, streaming: true }
            return next
          })
        } else {
          finalData = chunk.data
          setMessages((prev) => {
            const next = [...prev]
            next[next.length - 1] = { role: "assistant", content: chunk.data.reply || fullText }
            return next
          })
          if (!open || minimized) setUnread((n) => n + 1)
        }
      }

    } catch {
      setMessages((prev) => {
        const next = [...prev]
        next[next.length - 1] = {
          role   : "assistant",
          content: "Une erreur s'est produite. Veuillez réessayer.",
        }
        return next
      })
    } finally {
      setSending(false)
    }

    // ── Execute visual actions OUTSIDE try/catch so querySelector errors
    //    never overwrite the assistant message ─────────────────────────────
    if (!finalData) return

    console.log("[Onboarder] finalData:", finalData.intent, finalData.actions, "overlayRef:", overlayRef.current)

    if (finalData.intent === "guide_flow" || finalData.intent === "guide") {
      if (finalData.flow?.steps?.length) {
        startFlowGuide(finalData.flow, q)
      } else {
        await startGuide(q)
      }
    } else if (Array.isArray(finalData.actions) && finalData.actions.length) {
      const actions = finalData.actions as Array<Record<string, unknown>>
      console.log("[Onboarder] executing actions:", actions)
      for (const action of actions) {
        try {
          const t   = action.type as string
          const sel = action.selector as string | undefined
          console.log("[Onboarder] action:", t, sel)
          if (t === "spotlight" && sel)      overlayRef.current?.spotlight(sel)
          else if (t === "pulse" && sel)     overlayRef.current?.pulse(sel)
          else if (t === "tooltip" && sel)   overlayRef.current?.tooltip(sel, (action.text as string) || "")
          else if (t === "spotlight_card") {
            const sc = action.spotlight_card as Record<string, any> | undefined
            if (sc?.selector) {
              overlayRef.current?.spotlight(sc.selector)
              overlayRef.current?.card(sc.selector, {
                title: sc.title,
                body: sc.body || "",
                cta_label: sc.cta_label,
                cta_url: sc.cta_url
              })
            }
          }
        } catch (e) { console.warn("[Onboarder] action error:", e) }
      }
    }
  }, [input, sending, userTraits, open, minimized, startGuide, startFlowGuide])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() }
  }

  // ── Derive config values (with defaults) ──────────────────────────────
  if (error) return null  // silent fail in production

  const cfg      = boot?.projectConfig ?? {}
  const color    = cfg.primaryColor    ?? "#6366f1"
  const name     = cfg.agentName       ?? "Assistant"
  const emoji    = cfg.agentEmoji      ?? "🤖"
  const pos      = cfg.widgetPosition  ?? "bottom-right"
  const avatarUrl = cfg.avatarUrl

  const posStyle: React.CSSProperties = pos === "bottom-left"
    ? { left: 20, bottom: 20 }
    : { right: 20, bottom: 20 }

  const gradient = `linear-gradient(135deg, ${color}, ${shiftColor(color, 40)})`

  const inGuideMode = !!(activeStep || guideLoading)

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <>
      {/* Keyframe animations injected once */}
      <style>{`
        @keyframes ob-bounce { 0%,80%,100% { transform:scale(0) } 40% { transform:scale(1) } }
        @keyframes ob-fadein { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes ob-pulse  { 0%,100% { box-shadow:0 0 0 4px ${hex2rgba(color,.25)} } 50% { box-shadow:0 0 0 8px ${hex2rgba(color,.1)} } }
        .ob-msg-in { animation: ob-fadein .18s ease }
      `}</style>

      {/* Guide overlay is rendered imperatively via OnboarderOverlay.showGuideStep() */}

      {/* ── Guide progress pill ───────────────────────────────────────── */}
      {inGuideMode && (
        <GuidePill
          stepNum={activeStep?.step_num ?? 1}
          isLoading={guideLoading}
          color={color}
          gradient={gradient}
          onStop={stopGuide}
        />
      )}

      <div style={{ position: "fixed", zIndex: 2147483600, display: "flex", flexDirection: "column", alignItems: pos === "bottom-left" ? "flex-start" : "flex-end", gap: 10, ...posStyle }}>

        {/* ── Chat panel ──────────────────────────────────────────── */}
        {open && !minimized && (
          <div className="ob-msg-in" style={{
            width: 380, maxWidth: "calc(100vw - 24px)",
            height: 540, maxHeight: "calc(100vh - 96px)",
            background: "#fff", borderRadius: 20,
            boxShadow: "0 20px 60px rgba(0,0,0,.18)",
            border: "1px solid #e2e8f0",
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}>

            {/* Header — driven by projectConfig */}
            <div style={{
              background: gradient,
              padding: "12px 14px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar emoji={emoji} avatarUrl={avatarUrl} color="#fff" size={36} />
                <div>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 14, lineHeight: 1.2,
                    fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
                    {name}
                  </div>
                  <div style={{ color: "rgba(255,255,255,.7)", fontSize: 11, marginTop: 2,
                    fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
                    {inGuideMode ? "En guidage…" : sessionId ? "En ligne" : "Connexion…"}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {inGuideMode && (
                  <Btn onClick={stopGuide} title="Arrêter le guidage" color={color}>⏹</Btn>
                )}
                <Btn onClick={() => setMinimized(true)}  title="Réduire"  color={color}>－</Btn>
                <Btn onClick={() => setOpen(false)}      title="Fermer"   color={color}>✕</Btn>
              </div>
            </div>

            {/* Messages */}
            <div style={{
              flex: 1, overflowY: "auto", padding: "14px 14px 8px",
              display: "flex", flexDirection: "column", gap: 10,
              background: "#f8fafc",
              fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
            }}>
              {messages.map((msg, i) => (
                <div key={i} className="ob-msg-in" style={{
                  display: "flex",
                  flexDirection: msg.role === "user" ? "row-reverse" : "row",
                  alignItems: "flex-end", gap: 7,
                }}>
                  {msg.role === "assistant" && (
                    <Avatar emoji={emoji} avatarUrl={avatarUrl} color={color} size={28} />
                  )}
                  <div style={{
                    maxWidth: "80%",
                    background: msg.role === "user" ? gradient : "#fff",
                    color    : msg.role === "user" ? "#fff" : "#1e293b",
                    borderRadius: msg.role === "user"
                      ? "18px 18px 4px 18px"
                      : "18px 18px 18px 4px",
                    padding  : "10px 13px",
                    fontSize : 13, lineHeight: 1.6,
                    boxShadow: msg.role === "assistant" ? "0 1px 4px rgba(0,0,0,.08)" : "none",
                    border   : msg.role === "assistant"
                      ? (msg.guideStep ? `1px solid ${hex2rgba(color, .4)}` : "1px solid #e2e8f0")
                      : "none",
                  }}>
                    {msg.guideStep && (
                      <span style={{
                        display: "inline-block", marginRight: 6,
                        background: gradient, color: "#fff",
                        borderRadius: 20, padding: "1px 8px", fontSize: 11, fontWeight: 600,
                      }}>
                        étape {msg.guideStep}
                      </span>
                    )}
                    {msg.streaming && !msg.content
                      ? <TypingDots />
                      : msg.content}
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>

            {/* Input */}
            <div style={{
              padding: "10px 12px", borderTop: "1px solid #e2e8f0",
              display: "flex", gap: 8, background: "#fff", flexShrink: 0,
            }}>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                disabled={!sessionId || sending || guideLoading}
                placeholder={
                  guideLoading ? "Analyse en cours…"
                  : inGuideMode ? "Guidage actif — suivez les instructions"
                  : sessionId   ? "Posez votre question…"
                  : "Chargement…"
                }
                style={{
                  flex: 1, fontSize: 13, padding: "9px 13px",
                  border: "1px solid #e2e8f0", borderRadius: 12,
                  outline: "none", background: "#f8fafc",
                  fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
                  color: "#334155",
                  opacity: (!sessionId || sending || guideLoading) ? .5 : 1,
                  transition: "border-color .15s",
                }}
                onFocus={(e) => (e.target.style.borderColor = color)}
                onBlur={(e)  => (e.target.style.borderColor = "#e2e8f0")}
              />
              <button
                onClick={send}
                disabled={!input.trim() || sending || !sessionId || guideLoading}
                style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: (!input.trim() || sending || !sessionId || guideLoading) ? "#e2e8f0" : gradient,
                  border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "background .15s, opacity .15s",
                  flexShrink: 0,
                }}
              >
                {sending
                  ? <SpinnerIcon color="#94a3b8" />
                  : <SendIcon color={!input.trim() || !sessionId || guideLoading ? "#94a3b8" : "#fff"} />}
              </button>
            </div>

            {/* Powered-by footer */}
            {!cfg.poweredByHidden && (
              <div style={{
                textAlign: "center", fontSize: 10, color: "#94a3b8", padding: "4px 0 6px",
                fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
              }}>
                Propulsé par <strong style={{ color }}>Onboarder</strong>
              </div>
            )}
          </div>
        )}

        {/* ── Minimized pill ─────────────────────────────────────── */}
        {open && minimized && (
          <button
            className="ob-msg-in"
            onClick={() => { setMinimized(false); setUnread(0) }}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: gradient, color: "#fff",
              border: "none", borderRadius: 100, cursor: "pointer",
              padding: "8px 16px",
              boxShadow: "0 4px 16px rgba(0,0,0,.2)",
              fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
              fontSize: 13, fontWeight: 600,
            }}
          >
            <span>{emoji}</span>
            <span>{name}</span>
            {unread > 0 && (
              <span style={{
                background: "#fff", color,
                borderRadius: "50%", width: 18, height: 18,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 800,
              }}>{unread > 9 ? "9+" : unread}</span>
            )}
          </button>
        )}

        {/* ── FAB ────────────────────────────────────────────────── */}
        {!open && (
          <button
            onClick={() => { setOpen(true); setMinimized(false); setUnread(0) }}
            style={{
              width: 56, height: 56, borderRadius: "50%",
              background: gradient, border: "none", cursor: "pointer",
              boxShadow: "0 4px 20px rgba(0,0,0,.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24, transition: "transform .15s, box-shadow .15s",
              animation: "ob-pulse 2.5s ease-in-out infinite",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.08)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            aria-label={`Ouvrir ${name}`}
          >
            {unread > 0
              ? <UnreadBadge count={unread} />
              : emoji}
          </button>
        )}
      </div>
    </>
  )
}

// ─── Tiny icon components (no dep) ───────────────────────────────────────────

function Btn({ onClick, title, color, children }: {
  onClick: () => void; title: string; color: string; children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: "rgba(255,255,255,.15)", border: "none", cursor: "pointer",
        width: 28, height: 28, borderRadius: 8, color: "#fff",
        fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center",
        transition: "background .12s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.25)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.15)")}
    >
      {children}
    </button>
  )
}

function SendIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2 11 13"/><path d="M22 2 15 22 11 13 2 9l20-7z"/>
    </svg>
  )
}

function SpinnerIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83">
        <animateTransform attributeName="transform" type="rotate" values="0 12 12;360 12 12" dur=".8s" repeatCount="indefinite"/>
      </path>
    </svg>
  )
}

function UnreadBadge({ count }: { count: number }) {
  return (
    <div style={{ position: "relative", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontSize: 24 }}>💬</span>
      <span style={{
        position: "absolute", top: -4, right: -4,
        background: "#ef4444", color: "#fff",
        borderRadius: "50%", width: 18, height: 18,
        fontSize: 10, fontWeight: 800,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>{count > 9 ? "9+" : count}</span>
    </div>
  )
}

// ─── Color shift helper ───────────────────────────────────────────────────────

function shiftColor(hex: string, amount: number): string {
  try {
    const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount)
    const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount)
    const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount)
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
  } catch {
    return hex
  }
}

export type { ProjectConfig }
