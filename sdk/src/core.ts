/**
 * core.ts — Onboarder SDK core (framework-agnostic)
 *
 * Importable as ESM or CJS in any JS framework.
 * Does NOT auto-init and does NOT touch window.Onboarder.
 * Used by the React, Vue, and Angular wrappers.
 *
 * Overlay types supported:
 *   spotlight_card  — darkened backdrop + card anchored to an element
 *   info_modal      — centered modal (new features, announcements)
 *   hotspot         — pulsing dot on an element with click-to-expand tooltip
 *   hotspot_group   — multiple hotspots at once
 *   banner          — full-width sticky top/bottom bar
 *   checklist       — floating onboarding checklist panel
 *   progress_pill   — top-center flow progress indicator
 *   highlight       — border + pulse glow on an element
 *   tooltip         — highlight + text label near element
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SDKConfig {
  projectId   : string;
  anonKey     : string;
  supabaseUrl : string;
  userId?     : string;
  userTraits? : Record<string, unknown>;
  locale?     : string;
}

export interface ActionTarget {
  element_id?        : string;
  selector?          : string;
  xpath?             : string;
  aria_label?        : string;
  text?              : string;
  fallback_selector? : string;
}

export interface AgentAction {
  id          : string;
  action_type : string;
  target      : ActionTarget;
  data?       : unknown;
  options?    : {
    highlight?       : boolean;
    delay_ms?        : number;
    scroll_into_view?: boolean;
    duration_ms?     : number;
  };
  sequence    : number;
}

export interface ActionResult {
  success      : boolean;
  element_found: boolean;
  error?       : string;
  executed_at  : string;
}

export interface BannerData {
  id?       : string;
  title?    : string;
  body      : string;
  cta_label?: string;
  cta_url?  : string;
  style?    : "info" | "warning" | "success" | "promo";
  position? : "top" | "bottom";
  onDismiss?: () => void;
  onCta?    : () => void;
}

export interface ChecklistItem {
  id        : string;
  label     : string;
  description?: string;
  step_key  : string;
  flow_id?  : string;
  done      : boolean;
}

export interface ChecklistData {
  id?       : string;
  title     : string;
  items     : ChecklistItem[];
  onItemClick?: (item: ChecklistItem) => void;
  onDismiss?: () => void;
}

// ─── Element resolution ───────────────────────────────────────────────────────

export class ElementResolver {
  resolve(target: ActionTarget): Element | null {
    if (target.element_id) {
      const el = document.querySelector(`[data-onboarder-id="${target.element_id}"]`);
      if (el) return el;
    }
    if (target.selector) {
      const el = document.querySelector(target.selector);
      if (el) return el;
    }
    if (target.aria_label) {
      const el = document.querySelector(`[aria-label="${target.aria_label}"]`);
      if (el) return el;
    }
    if (target.text) {
      const el = this.findByText(target.text);
      if (el) return el;
    }
    if (target.fallback_selector) {
      const el = document.querySelector(target.fallback_selector);
      if (el) return el;
    }
    if (target.xpath) {
      const result = document.evaluate(target.xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      if (result.singleNodeValue instanceof Element) return result.singleNodeValue;
    }
    return null;
  }

  private findByText(text: string): Element | null {
    const normalized = text.trim().toLowerCase();
    const candidates = document.querySelectorAll("button, a, [role=button], [role=link], label");
    for (const el of candidates) {
      if (el.textContent?.trim().toLowerCase() === normalized) return el;
    }
    return null;
  }

  injectIds(nodes: Record<string, { selectors?: ActionTarget }>): void {
    for (const [id, node] of Object.entries(nodes)) {
      if (!node.selectors) continue;
      const el = this.resolve({ ...node.selectors, element_id: undefined });
      if (el && !el.getAttribute("data-onboarder-id")) {
        el.setAttribute("data-onboarder-id", id);
      }
    }
  }
}

// ─── Highlighter ──────────────────────────────────────────────────────────────

export class Highlighter {
  private overlay: HTMLElement | null = null;
  private tooltip: HTMLElement | null = null;

  highlight(el: Element, tooltipText?: string, durationMs = 3000): void {
    this.clear();
    const rect = el.getBoundingClientRect();

    this.overlay = document.createElement("div");
    Object.assign(this.overlay.style, {
      position      : "fixed",
      top           : `${rect.top - 4}px`,
      left          : `${rect.left - 4}px`,
      width         : `${rect.width + 8}px`,
      height        : `${rect.height + 8}px`,
      border        : "2px solid #6366f1",
      borderRadius  : "6px",
      boxShadow     : "0 0 0 4px rgba(99,102,241,0.2)",
      zIndex        : "2147483647",
      pointerEvents : "none",
      transition    : "all 0.2s ease",
      animation     : "onboarder-pulse 1.5s infinite",
    });
    document.body.appendChild(this.overlay);

    if (tooltipText) {
      this.tooltip = document.createElement("div");
      this.tooltip.textContent = tooltipText;
      Object.assign(this.tooltip.style, {
        position      : "fixed",
        top           : `${rect.bottom + 8}px`,
        left          : `${rect.left}px`,
        maxWidth      : "300px",
        padding       : "8px 12px",
        background    : "#1e1b4b",
        color         : "#fff",
        fontSize      : "13px",
        borderRadius  : "8px",
        zIndex        : "2147483647",
        pointerEvents : "none",
        boxShadow     : "0 4px 12px rgba(0,0,0,0.3)",
        lineHeight    : "1.5",
      });
      document.body.appendChild(this.tooltip);
    }

    if (durationMs > 0) setTimeout(() => this.clear(), durationMs);
  }

  clear(): void {
    this.overlay?.remove(); this.overlay = null;
    this.tooltip?.remove(); this.tooltip = null;
  }
}

// ─── Overlay manager ──────────────────────────────────────────────────────────

const BRAND  = "#6366f1";
const BRAND2 = "#8b5cf6";

const BANNER_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  info    : { bg: "#eff6ff", color: "#1e40af", border: "#bfdbfe" },
  warning : { bg: "#fffbeb", color: "#92400e", border: "#fde68a" },
  success : { bg: "#f0fdf4", color: "#14532d", border: "#bbf7d0" },
  promo   : { bg: `linear-gradient(135deg,${BRAND},${BRAND2})`, color: "#fff", border: "transparent" },
};

export class OverlayManager {
  private attr = "data-ob-sdk-overlay";

  private mk(css: Partial<CSSStyleDeclaration>): HTMLElement {
    const el = document.createElement("div");
    el.setAttribute(this.attr, "1");
    Object.assign(el.style, css);
    document.body.appendChild(el);
    return el;
  }

  private clip(rect: DOMRect, p = 10): string {
    const t = Math.max(0, rect.top    - p);
    const l = Math.max(0, rect.left   - p);
    const b = Math.min(window.innerHeight, rect.bottom + p);
    const r = Math.min(window.innerWidth,  rect.right  + p);
    return `polygon(0% 0%, 0% 100%, ${l}px 100%, ${l}px ${t}px, ${r}px ${t}px, ${r}px ${b}px, ${l}px ${b}px, ${l}px 100%, 100% 100%, 100% 0%)`;
  }

  // ── Spotlight card ──────────────────────────────────────────────────────

  showSpotlightCard(d: {
    selector  : string;
    title?    : string;
    body      : string;
    step?     : number;
    total?    : number;
    cta_label?: string;
    onCta?    : () => void;
  }): void {
    this.clearAll();
    const el = document.querySelector(d.selector) as HTMLElement | null;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });

    setTimeout(() => {
      const rect  = el.getBoundingClientRect();
      const total = d.total ?? 1;
      const step  = d.step  ?? 0;
      const vw    = window.innerWidth;

      this.mk({
        position: "fixed", inset: "0",
        zIndex: "2147483640", background: "rgba(0,0,0,0.6)",
        clipPath: this.clip(rect), transition: "clip-path 0.4s ease",
        pointerEvents: "auto",
      });
      this.mk({
        position: "fixed",
        top   : `${rect.top    - 10}px`, left  : `${rect.left   - 10}px`,
        width : `${rect.width  + 20}px`, height: `${rect.height + 20}px`,
        borderRadius: "8px", border: `2px solid ${BRAND}`,
        zIndex: "2147483641", pointerEvents: "none",
        boxShadow: `0 0 0 4px rgba(99,102,241,0.25)`,
      });

      const card = document.createElement("div");
      card.setAttribute(this.attr, "1");
      const CARD_W = 320;
      const side   = rect.right + 12 + CARD_W < vw ? "right"
                    : rect.left  - 12 - CARD_W > 0  ? "left"
                    : "bottom";
      const cx = rect.left + rect.width / 2;
      const cy = rect.top  + rect.height / 2;
      let top  = `${Math.max(16, cy - 100)}px`;
      let left : string;
      if      (side === "right") { left = `${rect.right + 12}px`; }
      else if (side === "left")  { left = `${Math.max(16, rect.left - 12 - CARD_W)}px`; }
      else { top = `${rect.bottom + 12}px`; left = `${Math.max(16, cx - CARD_W / 2)}px`; }

      Object.assign(card.style, {
        position: "fixed", top, left, width: `${CARD_W}px`,
        background: "#fff", borderRadius: "14px", padding: "18px 20px",
        boxShadow: "0 12px 48px rgba(0,0,0,0.22)",
        zIndex: "2147483642",
        fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      } as Partial<CSSStyleDeclaration>);

      card.innerHTML = `
        ${d.title ? `<div style="font-size:14px;font-weight:700;color:#1e293b;margin-bottom:8px;">${d.title}</div>` : ""}
        <div style="font-size:13px;line-height:1.65;color:#334155;margin-bottom:14px;">${d.body}</div>
        ${total > 1 ? `<div style="font-size:11px;color:#94a3b8;margin-bottom:12px;">${step + 1} / ${total}</div>` : ""}
        <button data-ob-cta style="width:100%;padding:10px;background:linear-gradient(135deg,${BRAND},${BRAND2});
          color:white;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
          ${d.cta_label ?? (step === (total - 1) ? "Terminer ✓" : "Suivant →")}
        </button>
      `;
      card.querySelector("[data-ob-cta]")!.addEventListener("click", () => {
        this.clearAll();
        if (d.onCta) d.onCta();
      });
      document.body.appendChild(card);
    }, 350);
  }

  // ── Info modal (new features / announcements) ───────────────────────────

  showInfoModal(d: {
    title           : string;
    body            : string;
    image_url?      : string;
    video_url?      : string;
    cta_label?      : string;
    secondary_label?: string;
    onCta?          : () => void;
    onSecondary?    : () => void;
  }): void {
    this.clearAll();
    const backdrop = document.createElement("div");
    backdrop.setAttribute(this.attr, "1");
    Object.assign(backdrop.style, {
      position: "fixed", inset: "0", background: "rgba(0,0,0,0.55)",
      zIndex: "2147483643", display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    } as Partial<CSSStyleDeclaration>);

    let mediaHtml = `<div style="height:5px;background:linear-gradient(90deg,${BRAND},${BRAND2});"></div>`;
    if (d.video_url) {
      mediaHtml = `<div style="padding-top:56.25%;position:relative;background:#000;">
        <iframe src="${d.video_url}" frameborder="0" allowfullscreen
          style="position:absolute;inset:0;width:100%;height:100%;"></iframe></div>`;
    } else if (d.image_url) {
      mediaHtml = `<img src="${d.image_url}" style="width:100%;max-height:200px;object-fit:cover;display:block;">`;
    }

    backdrop.innerHTML = `
      <div style="width:min(460px,calc(100vw - 32px));background:#fff;border-radius:18px;
        overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,0.28);">
        ${mediaHtml}
        <div style="padding:22px 22px 18px;">
          <h2 style="margin:0 0 10px;font-size:18px;font-weight:700;color:#0f172a;">${d.title}</h2>
          <p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#334155;">${d.body}</p>
          <button data-ob-cta style="width:100%;padding:12px;background:linear-gradient(135deg,${BRAND},${BRAND2});
            color:white;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;
            margin-bottom:${d.secondary_label ? "8px" : "0"};">${d.cta_label ?? "Fermer"}</button>
          ${d.secondary_label ? `<button data-ob-sec style="width:100%;padding:10px;background:#f1f5f9;
            color:#475569;border:none;border-radius:10px;font-size:13px;cursor:pointer;">${d.secondary_label}</button>` : ""}
        </div>
      </div>
    `;
    backdrop.querySelector("[data-ob-cta]")!.addEventListener("click", () => {
      this.clearAll();
      if (d.onCta) d.onCta();
    });
    backdrop.querySelector("[data-ob-sec]")?.addEventListener("click", () => {
      this.clearAll();
      if (d.onSecondary) d.onSecondary();
    });
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) this.clearAll(); });
    document.body.appendChild(backdrop);
  }

  // ── Hotspots (pulsing dots on UI elements) ──────────────────────────────

  showHotspot(items: Array<{ selector: string; title: string; body: string; side?: string }>): void {
    for (const item of items) {
      const el = document.querySelector(item.selector) as HTMLElement | null;
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width  / 2 + window.scrollX;
      const cy = rect.top  + rect.height / 2 + window.scrollY;

      const dot = document.createElement("div");
      dot.setAttribute(this.attr, "1");
      Object.assign(dot.style, {
        position: "absolute", top: `${cy - 7}px`, left: `${cx - 7}px`,
        width: "14px", height: "14px", borderRadius: "50%", background: BRAND,
        zIndex: "2147483645", cursor: "pointer",
        boxShadow: "0 0 0 4px rgba(99,102,241,0.25)",
        fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      } as Partial<CSSStyleDeclaration>);

      let tip: HTMLElement | null = null;
      dot.addEventListener("click", () => {
        if (tip) { tip.remove(); tip = null; return; }
        tip = document.createElement("div");
        tip.setAttribute(this.attr, "1");
        Object.assign(tip.style, {
          position: "absolute",
          top:  `${cy - 100 + window.scrollY}px`,
          left: `${Math.max(8, cx - 110 + window.scrollX)}px`,
          width: "220px", background: "#1e293b", color: "#f8fafc",
          borderRadius: "10px", padding: "10px 12px",
          fontSize: "12px", lineHeight: "1.5",
          zIndex: "2147483646", boxShadow: "0 6px 24px rgba(0,0,0,0.3)",
          fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
        } as Partial<CSSStyleDeclaration>);
        tip.innerHTML = `<strong style="display:block;margin-bottom:4px;color:#f8fafc;">${item.title}</strong>${item.body}`;
        document.body.appendChild(tip);
      });
      document.body.appendChild(dot);
    }
  }

  // ── Banner (full-width sticky strip) ───────────────────────────────────

  showBanner(d: BannerData): void {
    // Remove any existing banner at the same position
    const existingAttr = d.position === "bottom" ? "banner-bottom" : "banner-top";
    document.querySelector(`[${this.attr}="${existingAttr}"]`)?.remove();

    const style  = BANNER_STYLES[d.style ?? "info"];
    const isPromo = d.style === "promo";
    const pos    = d.position ?? "top";

    const banner = document.createElement("div");
    banner.setAttribute(this.attr, `banner-${pos}`);
    Object.assign(banner.style, {
      position  : "fixed",
      [pos]     : "0",
      left      : "0",
      right     : "0",
      zIndex    : "2147483648",
      background: style.bg,
      color     : style.color,
      borderBottom: pos === "top"    ? `1px solid ${style.border}` : "none",
      borderTop   : pos === "bottom" ? `1px solid ${style.border}` : "none",
      padding   : "10px 48px 10px 16px",
      display   : "flex",
      alignItems: "center",
      gap       : "12px",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      fontSize  : "14px",
      lineHeight: "1.5",
      boxShadow : pos === "top" ? "0 2px 8px rgba(0,0,0,0.08)" : "0 -2px 8px rgba(0,0,0,0.08)",
    } as Partial<CSSStyleDeclaration>);

    const textPart = d.title
      ? `<span><strong style="font-weight:700;">${d.title}</strong> ${d.body}</span>`
      : `<span style="flex:1;">${d.body}</span>`;

    const ctaPart = d.cta_label
      ? `<a data-ob-banner-cta href="${d.cta_url ?? "#"}"
           style="display:inline-block;padding:5px 14px;border-radius:6px;
             background:${isPromo ? "rgba(255,255,255,0.2)" : style.color};
             color:${isPromo ? "#fff" : style.bg};
             font-size:13px;font-weight:600;text-decoration:none;
             border:1px solid ${isPromo ? "rgba(255,255,255,0.3)" : style.color};
             white-space:nowrap;">
           ${d.cta_label}
         </a>`
      : "";

    banner.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;flex:1;flex-wrap:wrap;">
        ${textPart}
        ${ctaPart}
      </div>
      <button data-ob-banner-close
        style="position:absolute;right:12px;top:50%;transform:translateY(-50%);
          background:none;border:none;cursor:pointer;opacity:0.6;padding:4px;
          font-size:18px;line-height:1;color:inherit;">×</button>
    `;

    if (d.cta_url && d.onCta) {
      banner.querySelector("[data-ob-banner-cta]")?.addEventListener("click", (e) => {
        e.preventDefault();
        if (d.onCta) d.onCta();
      });
    }

    banner.querySelector("[data-ob-banner-close]")!.addEventListener("click", () => {
      banner.remove();
      if (d.onDismiss) d.onDismiss();
    });

    document.body.appendChild(banner);
  }

  // ── Checklist (floating onboarding todo panel) ──────────────────────────

  showChecklist(d: ChecklistData): void {
    const existingId = d.id ?? "default";
    document.querySelector(`[${this.attr}="checklist-${existingId}"]`)?.remove();

    const doneCount = d.items.filter(i => i.done).length;
    const total     = d.items.length;
    const pct       = total > 0 ? Math.round((doneCount / total) * 100) : 0;

    const panel = document.createElement("div");
    panel.setAttribute(this.attr, `checklist-${existingId}`);
    Object.assign(panel.style, {
      position  : "fixed",
      bottom    : "80px",
      right     : "16px",
      width     : "300px",
      zIndex    : "2147483644",
      background: "#fff",
      borderRadius: "16px",
      boxShadow : "0 8px 40px rgba(0,0,0,0.18)",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      overflow  : "hidden",
    } as Partial<CSSStyleDeclaration>);

    const itemsHtml = d.items.map(item => `
      <li data-ob-cl-item="${item.id}"
        style="display:flex;align-items:flex-start;gap:10px;padding:10px 14px;
          cursor:pointer;border-bottom:1px solid #f1f5f9;transition:background 0.15s;
          ${item.done ? "opacity:0.55;" : ""}">
        <div style="width:20px;height:20px;border-radius:50%;flex-shrink:0;margin-top:1px;
          display:flex;align-items:center;justify-content:center;font-size:11px;
          ${item.done
            ? `background:${BRAND};color:#fff;`
            : `border:2px solid #e2e8f0;color:transparent;`}">
          ${item.done ? "✓" : ""}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:${item.done ? "400" : "500"};
            color:${item.done ? "#94a3b8" : "#1e293b"};
            text-decoration:${item.done ? "line-through" : "none"};">${item.label}</div>
          ${item.description ? `<div style="font-size:11px;color:#94a3b8;margin-top:2px;">${item.description}</div>` : ""}
        </div>
        ${item.flow_id && !item.done ? `<div style="font-size:11px;color:${BRAND};font-weight:500;flex-shrink:0;">▶</div>` : ""}
      </li>
    `).join("");

    panel.innerHTML = `
      <!-- Header -->
      <div style="background:linear-gradient(135deg,${BRAND},${BRAND2});padding:14px 16px;color:#fff;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:14px;font-weight:700;">${d.title}</span>
          <div style="display:flex;gap:6px;">
            <button data-ob-cl-min style="background:rgba(255,255,255,0.2);border:none;
              cursor:pointer;border-radius:4px;padding:2px 6px;color:#fff;font-size:12px;">–</button>
            <button data-ob-cl-close style="background:rgba(255,255,255,0.2);border:none;
              cursor:pointer;border-radius:4px;padding:2px 6px;color:#fff;font-size:12px;">×</button>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="flex:1;height:4px;background:rgba(255,255,255,0.3);border-radius:2px;overflow:hidden;">
            <div style="width:${pct}%;height:100%;background:#fff;border-radius:2px;transition:width 0.4s;"></div>
          </div>
          <span style="font-size:11px;font-weight:600;">${doneCount}/${total}</span>
        </div>
      </div>
      <!-- Items -->
      <ul data-ob-cl-list style="list-style:none;margin:0;padding:0;max-height:320px;overflow-y:auto;">
        ${itemsHtml}
      </ul>
    `;

    // Minimize / expand
    const list   = panel.querySelector("[data-ob-cl-list]") as HTMLElement;
    let minimized = false;
    panel.querySelector("[data-ob-cl-min]")!.addEventListener("click", () => {
      minimized = !minimized;
      list.style.display = minimized ? "none" : "block";
      (panel.querySelector("[data-ob-cl-min]") as HTMLElement).textContent = minimized ? "+" : "–";
    });

    // Close
    panel.querySelector("[data-ob-cl-close]")!.addEventListener("click", () => {
      panel.remove();
      if (d.onDismiss) d.onDismiss();
    });

    // Item clicks
    panel.querySelectorAll("[data-ob-cl-item]").forEach((li) => {
      li.addEventListener("click", () => {
        const itemId = (li as HTMLElement).dataset.obClItem;
        const item   = d.items.find(i => i.id === itemId);
        if (item) d.onItemClick?.(item);
      });
      (li as HTMLElement).addEventListener("mouseenter", () => {
        if (!(li as HTMLElement).style.textDecoration) {
          (li as HTMLElement).style.background = "#f8fafc";
        }
      });
      (li as HTMLElement).addEventListener("mouseleave", () => {
        (li as HTMLElement).style.background = "";
      });
    });

    document.body.appendChild(panel);
  }

  // ── Progress pill ───────────────────────────────────────────────────────

  showProgressPill(d: { flowName: string; step: number; total: number }): void {
    document.querySelector(`[${this.attr}="pill"]`)?.remove();
    const pill = document.createElement("div");
    pill.setAttribute(this.attr, "pill");
    const pct = Math.round((d.step / d.total) * 100);
    Object.assign(pill.style, {
      position: "fixed", top: "20px", left: "50%", transform: "translateX(-50%)",
      zIndex: "2147483644", background: "#1e293b", color: "#f8fafc",
      borderRadius: "100px", padding: "8px 16px",
      display: "flex", alignItems: "center", gap: "10px",
      boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      fontSize: "12px", fontWeight: "500", whiteSpace: "nowrap",
    } as Partial<CSSStyleDeclaration>);
    pill.innerHTML = `
      <span style="background:linear-gradient(135deg,${BRAND},${BRAND2});color:white;
        border-radius:100px;padding:2px 8px;font-size:11px;font-weight:700;">${d.step} / ${d.total}</span>
      <span style="color:#cbd5e1;max-width:160px;overflow:hidden;text-overflow:ellipsis;">${d.flowName}</span>
      <div style="width:60px;height:4px;background:#334155;border-radius:2px;overflow:hidden;">
        <div style="width:${pct}%;height:100%;background:${BRAND};border-radius:2px;"></div>
      </div>
      <button style="background:none;border:none;cursor:pointer;color:#94a3b8;font-size:13px;padding:0;line-height:1;">✕</button>
    `;
    pill.querySelector("button")!.addEventListener("click", () => pill.remove());
    document.body.appendChild(pill);
  }

  clearAll(): void {
    document.querySelectorAll(`[${this.attr}]`).forEach((el) => el.remove());
  }
}

// ─── Action executor ──────────────────────────────────────────────────────────

export class ActionExecutor {
  constructor(
    private resolver   : ElementResolver,
    private highlighter: Highlighter,
    private overlays   : OverlayManager = new OverlayManager(),
  ) {}

  async execute(action: AgentAction, onCta?: () => void): Promise<ActionResult> {
    const base = { executed_at: new Date().toISOString() };

    if (action.options?.delay_ms) await this.sleep(action.options.delay_ms);

    if (action.action_type === "navigate") {
      const url = (action.data as { url?: string })?.url ?? String(action.data ?? "");
      if (url) window.location.href = url;
      return { ...base, success: true, element_found: false };
    }
    if (action.action_type === "wait") {
      await this.sleep((action.data as { ms?: number })?.ms ?? Number(action.data ?? 500));
      return { ...base, success: true, element_found: false };
    }
    if (action.action_type === "scroll" && !(action.target?.element_id || action.target?.selector)) {
      const d = action.data as { x?: number; y?: number } | null;
      window.scrollTo({ top: d?.y ?? 0, left: d?.x ?? 0, behavior: "smooth" });
      return { ...base, success: true, element_found: false };
    }
    if (action.action_type === "spotlight_card") {
      const d = action.data as Parameters<OverlayManager["showSpotlightCard"]>[0];
      this.overlays.showSpotlightCard({ ...d, onCta });
      return { ...base, success: true, element_found: false };
    }
    if (action.action_type === "info_modal") {
      const d = action.data as Parameters<OverlayManager["showInfoModal"]>[0];
      this.overlays.showInfoModal({ ...d, onCta });
      return { ...base, success: true, element_found: false };
    }
    if (action.action_type === "hotspot") {
      const d = action.data as { selector: string; title: string; body: string; side?: string };
      this.overlays.showHotspot([d]);
      return { ...base, success: true, element_found: false };
    }
    if (action.action_type === "hotspot_group") {
      const d = action.data as Array<{ selector: string; title: string; body: string; side?: string }>;
      if (Array.isArray(d)) this.overlays.showHotspot(d);
      return { ...base, success: true, element_found: false };
    }
    if (action.action_type === "banner") {
      this.overlays.showBanner(action.data as BannerData);
      return { ...base, success: true, element_found: false };
    }
    if (action.action_type === "checklist") {
      this.overlays.showChecklist(action.data as ChecklistData);
      return { ...base, success: true, element_found: false };
    }
    if (action.action_type === "progress_pill") {
      this.overlays.showProgressPill(action.data as Parameters<OverlayManager["showProgressPill"]>[0]);
      return { ...base, success: true, element_found: false };
    }
    if (action.action_type === "clear_overlays") {
      this.overlays.clearAll();
      return { ...base, success: true, element_found: false };
    }

    const el = this.resolver.resolve(action.target);
    if (!el) return { ...base, success: false, element_found: false, error: `Element not found: ${JSON.stringify(action.target)}` };

    if (action.options?.scroll_into_view !== false) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      await this.sleep(300);
    }
    if (action.options?.highlight !== false && action.action_type !== "tooltip") {
      this.highlighter.highlight(el, undefined, 1500);
    }

    try {
      switch (action.action_type) {
        case "click":     (el as HTMLElement).click(); break;
        case "fill": {
          const value = String((action.data as { value?: unknown })?.value ?? action.data ?? "");
          if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
            el.focus(); el.value = value;
            el.dispatchEvent(new Event("input",  { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
          }
          break;
        }
        case "clear": {
          if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
            el.focus(); el.value = "";
            el.dispatchEvent(new Event("input",  { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
          }
          break;
        }
        case "select": {
          const option = String((action.data as { option?: unknown })?.option ?? action.data ?? "");
          if (el instanceof HTMLSelectElement) {
            const opt = Array.from(el.options).find(
              o => o.value === option || o.text.trim().toLowerCase() === option.toLowerCase()
            );
            if (opt) { el.value = opt.value; el.dispatchEvent(new Event("change", { bubbles: true })); }
          }
          break;
        }
        case "focus":  (el as HTMLElement).focus(); break;
        case "hover":
          el.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
          el.dispatchEvent(new MouseEvent("mouseover",  { bubbles: true }));
          break;
        case "scroll":    el.scrollIntoView({ behavior: "smooth", block: "center" }); break;
        case "key_press": {
          const key = (action.data as { key?: string })?.key ?? String(action.data ?? "Enter");
          el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
          el.dispatchEvent(new KeyboardEvent("keyup",   { key, bubbles: true }));
          break;
        }
        case "highlight":
          this.highlighter.highlight(el, (action.data as { text?: string })?.text, action.options?.duration_ms ?? 3000);
          break;
        case "tooltip":
          this.highlighter.highlight(el, (action.data as { text?: string })?.text ?? "", action.options?.duration_ms ?? 5000);
          break;
      }
      return { ...base, success: true, element_found: true };
    } catch (err) {
      return { ...base, success: false, element_found: true, error: String(err) };
    }
  }

  private sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
}

// ─── Supabase Realtime client ─────────────────────────────────────────────────

export class RealtimeClient {
  private ws       : WebSocket | null = null;
  private handlers = new Map<string, (payload: unknown) => void>();
  private heartbeat: ReturnType<typeof setInterval> | null = null;

  constructor(
    private supabaseUrl: string,
    private anonKey    : string,
    private sessionId  : string,
  ) {}

  connect(onAction: (action: AgentAction) => void): void {
    const wsUrl = this.supabaseUrl
      .replace("https://", "wss://")
      .replace("http://",  "ws://")
      + `/realtime/v1/websocket?apikey=${this.anonKey}&vsn=1.0.0`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.joinChannel(onAction);
      this.heartbeat = setInterval(() => {
        this.send({ topic: "phoenix", event: "heartbeat", payload: {}, ref: null });
      }, 30_000);
    };

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as { topic: string; event: string; payload: unknown; ref: string | null };
        this.handlers.get(`${msg.topic}:${msg.event}`)?.(msg.payload);
      } catch { /* ignore */ }
    };

    this.ws.onclose = () => {
      if (this.heartbeat) clearInterval(this.heartbeat);
      setTimeout(() => this.connect(onAction), 3000);
    };
  }

  private joinChannel(onAction: (action: AgentAction) => void): void {
    const topic = `realtime:public:onboarder_agent_actions:session_id=eq.${this.sessionId}`;
    this.send({ topic, event: "phx_join", payload: { config: { broadcast: { self: false } } }, ref: "1" });
    this.handlers.set(`${topic}:INSERT`, (payload) => {
      const action = (payload as { record?: AgentAction })?.record;
      if (action) onAction(action);
    });
  }

  private send(msg: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  disconnect(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.ws?.close();
  }
}

// ─── CSS injection helper ─────────────────────────────────────────────────────

export function injectOnboarderStyles(): void {
  if (document.getElementById("ob-styles")) return;
  const style = document.createElement("style");
  style.id = "ob-styles";
  style.textContent = `
    @keyframes onboarder-pulse {
      0%   { box-shadow: 0 0 0 4px rgba(99,102,241,0.3); }
      50%  { box-shadow: 0 0 0 8px rgba(99,102,241,0.1); }
      100% { box-shadow: 0 0 0 4px rgba(99,102,241,0.3); }
    }
  `;
  document.head.appendChild(style);
}

// ─── Main SDK class ───────────────────────────────────────────────────────────

interface FlowStepResponse {
  step        : { id: string; message: string; actions: unknown[]; display_mode?: string };
  step_index  : number;
  total_steps : number;
  is_last     : boolean;
  flow_name   : string;
}

export class OnboarderSDK {
  private sessionId   : string | null = null;
  private resolver    = new ElementResolver();
  private highlighter = new Highlighter();
  private overlays    = new OverlayManager();
  private executor    : ActionExecutor;
  private realtime    : RealtimeClient | null = null;
  private config      : SDKConfig | null = null;
  private actionQueue : AgentAction[] = [];
  private processing  = false;
  private activeFlows = new Set<string>();

  constructor() {
    this.executor = new ActionExecutor(this.resolver, this.highlighter, this.overlays);
    injectOnboarderStyles();
  }

  async init(config: SDKConfig): Promise<void> {
    this.config = config;

    const res = await fetch(`${config.supabaseUrl}/rest/v1/onboarder_sessions`, {
      method : "POST",
      headers: {
        "Content-Type" : "application/json",
        "apikey"       : config.anonKey,
        "Authorization": `Bearer ${config.anonKey}`,
        "Prefer"       : "return=representation",
      },
      body: JSON.stringify({
        project_id   : config.projectId,
        user_id      : config.userId ?? null,
        user_traits  : config.userTraits ?? {},
        status       : "active",
        current_route: window.location.pathname,
        sdk_version  : "1.0.0",
        user_agent   : navigator.userAgent,
        locale       : config.locale ?? navigator.language ?? "en",
      }),
    });

    if (!res.ok) { console.error("[Onboarder] Failed to create session:", res.status); return; }

    const [session] = await res.json() as Array<{ id: string }>;
    this.sessionId = session.id;

    this.loadAndInjectManifest(config);
    this.trackRouteChanges(config);

    this.realtime = new RealtimeClient(config.supabaseUrl, config.anonKey, this.sessionId);
    this.realtime.connect((action) => this.enqueueAction(action));

    // Load and render active content (banners, checklists, auto-flows)
    this.loadContent();
  }

  // ── Content delivery ────────────────────────────────────────────────────

  async loadContent(): Promise<void> {
    if (!this.config || !this.sessionId) return;
    const { supabaseUrl, projectId } = this.config;
    const route = window.location.pathname;

    try {
      const res = await fetch(
        `${supabaseUrl}/functions/v1/content?projectId=${projectId}&sessionId=${this.sessionId}&route=${encodeURIComponent(route)}`,
        { headers: { "Content-Type": "application/json" } },
      );
      if (!res.ok) return;

      const data = await res.json() as {
        banners    : Array<BannerData & { id: string }>;
        checklists : Array<ChecklistData & { id: string; items: ChecklistItem[] }>;
        flows      : Array<{ id: string; name: string }>;
      };

      // ── Show banners ──────────────────────────────────────────────────
      for (const banner of data.banners ?? []) {
        this.overlays.showBanner({
          ...banner,
          onDismiss: () => this.markShown("banner", banner.id),
        });
      }

      // ── Show checklists ───────────────────────────────────────────────
      for (const checklist of data.checklists ?? []) {
        this.overlays.showChecklist({
          ...checklist,
          onItemClick: (item) => {
            if (item.flow_id) {
              // Launch the linked flow
              this.playFlow(item.flow_id).catch(console.error);
            } else {
              // Mark item done directly
              this.markStepDone(item.step_key);
              // Refresh checklist display
              this.loadContent();
            }
          },
          onDismiss: () => this.markShown("checklist", checklist.id),
        });
      }

      // ── Auto-start route-triggered flows ─────────────────────────────
      for (const flow of data.flows ?? []) {
        if (!this.activeFlows.has(flow.id)) {
          this.playFlow(flow.id).catch(console.error);
        }
      }
    } catch (err) {
      console.error("[Onboarder] loadContent error:", err);
    }
  }

  // ── Flow player ─────────────────────────────────────────────────────────

  async playFlow(flowId: string, startStep = 0): Promise<void> {
    if (!this.config || !this.sessionId) return;
    if (this.activeFlows.has(flowId)) return;

    this.activeFlows.add(flowId);

    try {
      await this.advanceFlow(flowId, startStep);
    } finally {
      this.activeFlows.delete(flowId);
    }
  }

  private async advanceFlow(flowId: string, stepIndex: number): Promise<void> {
    if (!this.config || !this.sessionId) return;

    const res = await fetch(`${this.config.supabaseUrl}/functions/v1/flow-executor`, {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify({
        flow_id   : flowId,
        session_id: this.sessionId,
        step_index: stepIndex,
      }),
    });

    if (!res.ok) {
      console.error("[Onboarder] flow-executor error:", res.status);
      return;
    }

    const data = await res.json() as FlowStepResponse;

    // Show progress pill
    this.overlays.showProgressPill({
      flowName: data.flow_name,
      step    : stepIndex + 1,
      total   : data.total_steps,
    });

    // Determine onCta: advance to next step or finish
    const onCta = data.is_last
      ? () => {
          this.overlays.clearAll();
          this.markStepDone(`flow:${flowId}:done`);
        }
      : () => this.advanceFlow(flowId, stepIndex + 1).catch(console.error);

    // Execute step actions
    const actions = (Array.isArray(data.step.actions) ? data.step.actions : []) as AgentAction[];
    for (const action of actions) {
      const raw = { ...action, id: action.id ?? crypto.randomUUID(), sequence: action.sequence ?? 0 };
      await this.executor.execute(raw, onCta);
    }

    // If no display action was in the step, show a default card
    const hasDisplayAction = actions.some(a =>
      ["spotlight_card", "info_modal", "hotspot", "hotspot_group", "banner"].includes(
        (a as AgentAction).action_type
      )
    );

    if (!hasDisplayAction && data.step.message) {
      this.overlays.showSpotlightCard({
        selector : "body",
        title    : data.flow_name,
        body     : data.step.message,
        step     : stepIndex,
        total    : data.total_steps,
        onCta,
      });
    }
  }

  // ── Progress helpers ────────────────────────────────────────────────────

  private async markStepDone(stepKey: string): Promise<void> {
    if (!this.config || !this.sessionId) return;
    try {
      await fetch(`${this.config.supabaseUrl}/functions/v1/session?action=update`, {
        method : "PATCH",
        headers: { "Content-Type": "application/json" },
        body   : JSON.stringify({
          sessionId    : this.sessionId,
          completedStep: stepKey,
        }),
      });
    } catch { /* non-blocking */ }
  }

  private async markShown(type: string, id: string): Promise<void> {
    return this.markStepDone(`${type}:${id}:shown`);
  }

  // ── Internal helpers ────────────────────────────────────────────────────

  private async loadAndInjectManifest(config: SDKConfig): Promise<void> {
    try {
      const res = await fetch(
        `${config.supabaseUrl}/rest/v1/onboarder_manifests?project_id=eq.${config.projectId}&select=manifest`,
        { headers: { "apikey": config.anonKey, "Authorization": `Bearer ${config.anonKey}` } },
      );
      if (!res.ok) return;
      const [row] = await res.json() as Array<{ manifest: { nodes?: Record<string, { selectors?: ActionTarget }> } }>;
      if (row?.manifest?.nodes) this.resolver.injectIds(row.manifest.nodes);
    } catch { /* non-blocking */ }
  }

  private trackRouteChanges(config: SDKConfig): void {
    const update = () => {
      if (!this.sessionId) return;
      fetch(`${config.supabaseUrl}/rest/v1/onboarder_sessions?id=eq.${this.sessionId}`, {
        method : "PATCH",
        headers: {
          "Content-Type" : "application/json",
          "apikey"       : config.anonKey,
          "Authorization": `Bearer ${config.anonKey}`,
        },
        body: JSON.stringify({ current_route: window.location.pathname, last_seen_at: new Date().toISOString() }),
      }).catch(() => {});
      // Reload content on route change (triggers route-based banners/flows)
      this.loadContent();
    };

    const orig = history.pushState.bind(history);
    history.pushState = (...args) => { orig(...args); update(); };
    window.addEventListener("popstate", update);
  }

  private enqueueAction(action: AgentAction): void {
    this.actionQueue.push(action);
    this.actionQueue.sort((a, b) => a.sequence - b.sequence);
    if (!this.processing) this.processQueue();
  }

  private async processQueue(): Promise<void> {
    this.processing = true;
    while (this.actionQueue.length > 0) {
      const action = this.actionQueue.shift()!;
      const result = await this.executor.execute(action);
      await this.reportResult(action.id, result);
    }
    this.processing = false;
  }

  private async reportResult(actionId: string, result: ActionResult): Promise<void> {
    if (!this.config || !this.sessionId) return;
    try {
      await fetch(`${this.config.supabaseUrl}/rest/v1/onboarder_agent_actions?id=eq.${actionId}`, {
        method : "PATCH",
        headers: {
          "Content-Type" : "application/json",
          "apikey"       : this.config.anonKey,
          "Authorization": `Bearer ${this.config.anonKey}`,
        },
        body: JSON.stringify({ status: result.success ? "executed" : "failed", result, executed_at: result.executed_at }),
      });
    } catch { /* non-blocking */ }
  }

  /**
   * Initialise the SDK using an opaque access token.
   *
   * The token is exchanged server-side via the `token-exchange` Edge Function
   * to retrieve the projectId + anonKey without embedding them in client code.
   */
  async initFromToken(
    token       : string,
    onboarderUrl: string,
    extra?      : Pick<SDKConfig, "userId" | "userTraits" | "locale">,
  ): Promise<void> {
    const res = await fetch(`${onboarderUrl}/functions/v1/token-exchange`, {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify({ token }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(`[Onboarder] token-exchange failed: ${err.error ?? res.status}`);
    }

    const cfg = await res.json() as {
      projectId    : string;
      anonKey      : string;
      supabaseUrl  : string;
      projectConfig: Record<string, unknown>;
    };

    await this.init({
      projectId  : cfg.projectId,
      anonKey    : cfg.anonKey,
      supabaseUrl: cfg.supabaseUrl,
      ...extra,
    });
  }

  /** Programmatic action execution (useful for testing/custom triggers) */
  async execute(actions: Omit<AgentAction, "id" | "sequence">[]): Promise<ActionResult[]> {
    return Promise.all(
      actions.map((a, i) => this.executor.execute({ ...a, id: crypto.randomUUID(), sequence: i }))
    );
  }

  getSessionId(): string | null { return this.sessionId; }

  destroy(): void {
    this.realtime?.disconnect();
    this.highlighter.clear();
    this.overlays.clearAll();
    if (this.config && this.sessionId) {
      navigator.sendBeacon(
        `${this.config.supabaseUrl}/rest/v1/onboarder_sessions?id=eq.${this.sessionId}`,
        JSON.stringify({ status: "ended", ended_at: new Date().toISOString() }),
      );
    }
  }
}
