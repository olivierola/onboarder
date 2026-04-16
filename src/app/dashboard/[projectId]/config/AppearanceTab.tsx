"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Megaphone, CheckSquare, MousePointerClick,
  PanelTop, Info, Sparkles, ChevronRight, Palette,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppearanceConfig {
  // Global
  primaryColor  : string;
  secondaryColor: string;
  fontFamily    : string;
  borderRadius  : number; // px — 0-24
  shadowStrength: "none" | "sm" | "md" | "lg";
  animationsOn  : boolean;
  // Banner
  banner: {
    style       : "info" | "warning" | "success" | "promo";
    position    : "top" | "bottom";
    fontSize    : number;
    paddingY    : number;
    iconVisible : boolean;
    dismissible : boolean;
  };
  // Modal
  modal: {
    maxWidth    : number;
    overlayOpacity: number;  // 0-100
    mediaHeight : number;
    ctaFullWidth: boolean;
    closeOnBackdrop: boolean;
  };
  // Spotlight
  spotlight: {
    overlayOpacity: number;
    cardWidth     : number;
    arrowVisible  : boolean;
    ringColor     : string;
    ringOpacity   : number;
  };
  // Tooltip / highlight
  tooltip: {
    background  : string;
    textColor   : string;
    fontSize    : number;
    maxWidth    : number;
    arrowVisible: boolean;
  };
  // Hotspot
  hotspot: {
    size       : number;
    pulseRings : number; // 1-3
    tipWidth   : number;
  };
  // Checklist
  checklist: {
    width         : number;
    position      : "bottom-right" | "bottom-left";
    maxHeight     : number;
    showProgress  : boolean;
    collapseOnDone: boolean;
  };
  // Progress pill
  pill: {
    position: "top-center" | "top-right" | "bottom-center";
    barWidth: number;
    showCount: boolean;
  };
}

export const DEFAULT_APPEARANCE: AppearanceConfig = {
  primaryColor  : "#6366f1",
  secondaryColor: "#8b5cf6",
  fontFamily    : "system",
  borderRadius  : 10,
  shadowStrength: "md",
  animationsOn  : true,
  banner: {
    style: "info", position: "top", fontSize: 14,
    paddingY: 10, iconVisible: true, dismissible: true,
  },
  modal: {
    maxWidth: 460, overlayOpacity: 55, mediaHeight: 200,
    ctaFullWidth: true, closeOnBackdrop: true,
  },
  spotlight: {
    overlayOpacity: 60, cardWidth: 320,
    arrowVisible: true, ringColor: "#6366f1", ringOpacity: 25,
  },
  tooltip: {
    background: "#1e1b4b", textColor: "#ffffff",
    fontSize: 13, maxWidth: 300, arrowVisible: false,
  },
  hotspot: { size: 14, pulseRings: 2, tipWidth: 220 },
  checklist: {
    width: 300, position: "bottom-right", maxHeight: 320,
    showProgress: true, collapseOnDone: false,
  },
  pill: { position: "top-center", barWidth: 60, showCount: true },
};

// ─── Mock content ─────────────────────────────────────────────────────────────

const MOCK = {
  bannerBody  : "🎉 Nouvelle fonctionnalité disponible — découvrez notre tableau de bord analytique.",
  bannerCta   : "Voir maintenant",
  modalTitle  : "Bienvenue sur le tableau de bord",
  modalBody   : "Explorez les nouvelles fonctionnalités de cette version. Commencez par configurer votre premier agent IA.",
  modalCta    : "Commencer",
  modalSec    : "Plus tard",
  spotlightBody: "Cliquez ici pour créer votre premier flow d'onboarding guidé.",
  spotlightTitle: "Créer un flow",
  tooltipText : "Configurez les paramètres avancés de votre agent",
  checkTitle  : "Démarrage rapide",
  checkItems  : [
    { label: "Créer un projet",          done: true  },
    { label: "Connecter une source",     done: true  },
    { label: "Lancer le premier scan",   done: false },
    { label: "Créer un flow d'onboarding", done: false },
    { label: "Installer le SDK",          done: false },
  ],
};

// ─── Sub-components ───────────────────────────────────────────────────────────

type ComponentKey = "banner" | "modal" | "spotlight" | "tooltip" | "hotspot" | "checklist" | "pill";

const COMPONENTS: { id: ComponentKey; label: string; icon: React.ElementType }[] = [
  { id: "banner",    label: "Bannière",  icon: Megaphone       },
  { id: "modal",     label: "Modale",    icon: PanelTop        },
  { id: "spotlight", label: "Spotlight", icon: Sparkles        },
  { id: "tooltip",   label: "Tooltip",   icon: Info            },
  { id: "hotspot",   label: "Hotspot",   icon: MousePointerClick },
  { id: "checklist", label: "Checklist", icon: CheckSquare     },
  { id: "pill",      label: "Pill",      icon: ChevronRight    },
];

// ─── Color swatch picker ──────────────────────────────────────────────────────

function ColorField({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color" value={value} onChange={e => onChange(e.target.value)}
          className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white"
        />
        <input
          type="text" value={value} onChange={e => onChange(e.target.value)}
          className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm
            focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-50 font-mono"
        />
      </div>
    </div>
  );
}

// ─── Slider field ─────────────────────────────────────────────────────────────

function SliderField({ label, value, min, max, step = 1, unit = "", onChange }: {
  label: string; value: number; min: number; max: number;
  step?: number; unit?: string; onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-slate-600">{label}</label>
        <span className="text-xs font-mono font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-md">
          {value}{unit}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ background: `linear-gradient(to right,#7c3aed ${pct}%,#e2e8f0 ${pct}%)` }}
      />
    </div>
  );
}

// ─── Select field ─────────────────────────────────────────────────────────────

function SelectField({ label, value, options, onChange }: {
  label: string; value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
      <select
        value={value} onChange={e => onChange(e.target.value)}
        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm
          focus:outline-none focus:border-violet-400 bg-white"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function ToggleField({ label, value, onChange }: {
  label: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-sm text-slate-700">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={cn(
          "relative rounded-full transition-colors shrink-0",
          value ? "bg-violet-600" : "bg-slate-200"
        )}
        style={{ width: 40, height: 22 }}
      >
        <span className={cn(
          "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform",
          value ? "translate-x-5" : "translate-x-0.5"
        )} />
      </button>
    </div>
  );
}

// ─── Preview components ───────────────────────────────────────────────────────

function BannerPreview({ cfg }: { cfg: AppearanceConfig }) {
  const { banner, primaryColor, secondaryColor, borderRadius, fontFamily } = cfg;
  const STYLES: Record<string, { bg: string; color: string; border: string }> = {
    info   : { bg: "#eff6ff", color: "#1e40af", border: "#bfdbfe" },
    warning: { bg: "#fffbeb", color: "#92400e", border: "#fde68a" },
    success: { bg: "#f0fdf4", color: "#14532d", border: "#bbf7d0" },
    promo  : { bg: `linear-gradient(135deg,${primaryColor},${secondaryColor})`, color: "#fff", border: "transparent" },
  };
  const s = STYLES[banner.style];
  const ff = fontFamily === "system" ? "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" : fontFamily;

  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-100 bg-slate-50 relative">
      <div className="text-[10px] font-medium text-slate-400 px-3 pt-2 pb-1 select-none">Aperçu — Bannière</div>
      <div
        style={{
          background: s.bg, color: s.color,
          borderTop: `1px solid ${s.border}`,
          borderBottom: `1px solid ${s.border}`,
          padding: `${banner.paddingY}px 40px ${banner.paddingY}px 16px`,
          fontSize: banner.fontSize,
          fontFamily: ff,
          display: "flex", alignItems: "center", gap: 12,
        }}
      >
        {banner.iconVisible && <span style={{ fontSize: 16 }}>📢</span>}
        <span style={{ flex: 1 }}>{MOCK.bannerBody}</span>
        <span style={{
          display: "inline-block", padding: "4px 12px",
          borderRadius: borderRadius / 2,
          background: banner.style === "promo" ? "rgba(255,255,255,0.25)" : s.color,
          color: banner.style === "promo" ? "#fff" : s.bg,
          fontSize: banner.fontSize - 1, fontWeight: 600,
          border: `1px solid ${banner.style === "promo" ? "rgba(255,255,255,0.3)" : s.color}`,
          cursor: "pointer", whiteSpace: "nowrap",
        }}>
          {MOCK.bannerCta}
        </span>
        {banner.dismissible && (
          <span style={{ opacity: 0.5, cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</span>
        )}
      </div>
      <div className="h-10 bg-slate-50" />
    </div>
  );
}

function ModalPreview({ cfg }: { cfg: AppearanceConfig }) {
  const { modal, primaryColor, secondaryColor, borderRadius, fontFamily } = cfg;
  const ff = fontFamily === "system" ? "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" : fontFamily;
  const br = borderRadius + 8;

  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-100 bg-slate-800/80 relative min-h-[260px] flex items-center justify-center p-4">
      <div className="text-[10px] font-medium text-slate-400 absolute top-2 left-3 select-none">Aperçu — Modale</div>
      <div style={{
        width: Math.min(modal.maxWidth, 320), background: "#fff",
        borderRadius: br, overflow: "hidden",
        boxShadow: "0 24px 80px rgba(0,0,0,0.28)", fontFamily: ff,
      }}>
        {/* gradient bar */}
        <div style={{ height: 5, background: `linear-gradient(90deg,${primaryColor},${secondaryColor})` }} />
        <div style={{ padding: "18px 18px 14px" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
            {MOCK.modalTitle}
          </h3>
          <p style={{ margin: "0 0 14px", fontSize: 12, lineHeight: 1.65, color: "#334155" }}>
            {MOCK.modalBody}
          </p>
          <button style={{
            display: "block", width: modal.ctaFullWidth ? "100%" : "auto",
            padding: "10px 20px",
            background: `linear-gradient(135deg,${primaryColor},${secondaryColor})`,
            color: "#fff", border: "none", borderRadius: borderRadius,
            fontSize: 13, fontWeight: 600, cursor: "pointer",
            marginBottom: 6,
          }}>{MOCK.modalCta}</button>
          <button style={{
            display: "block", width: modal.ctaFullWidth ? "100%" : "auto",
            padding: "8px 20px", background: "#f1f5f9",
            color: "#475569", border: "none", borderRadius: borderRadius,
            fontSize: 12, cursor: "pointer",
          }}>{MOCK.modalSec}</button>
        </div>
      </div>
    </div>
  );
}

function SpotlightPreview({ cfg }: { cfg: AppearanceConfig }) {
  const { spotlight, primaryColor, secondaryColor, borderRadius, fontFamily } = cfg;
  const ff = fontFamily === "system" ? "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" : fontFamily;
  const ringRgb = spotlight.ringColor.startsWith("#")
    ? `${parseInt(spotlight.ringColor.slice(1, 3), 16)},${parseInt(spotlight.ringColor.slice(3, 5), 16)},${parseInt(spotlight.ringColor.slice(5, 7), 16)}`
    : "99,102,241";

  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-100 relative min-h-[200px]"
      style={{ background: `rgba(0,0,0,${spotlight.overlayOpacity / 100})` }}>
      <div className="text-[10px] font-medium text-slate-400/70 absolute top-2 left-3 select-none">Aperçu — Spotlight</div>
      {/* Fake highlighted element */}
      <div className="absolute left-8 top-12">
        <button style={{
          background: "#fff", borderRadius: 8, padding: "8px 18px",
          fontSize: 13, fontWeight: 600, color: "#1e293b",
          border: `2px solid ${spotlight.ringColor}`,
          boxShadow: `0 0 0 4px rgba(${ringRgb},${spotlight.ringOpacity / 100})`,
        }}>
          Nouveau flow
        </button>
      </div>
      {/* Card */}
      <div style={{
        position: "absolute", left: "calc(8px + 120px)", top: 8,
        width: Math.min(spotlight.cardWidth, 240), background: "#fff",
        borderRadius: borderRadius + 4, padding: "14px 16px",
        boxShadow: "0 12px 40px rgba(0,0,0,0.25)", fontFamily: ff,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 6 }}>
          {MOCK.spotlightTitle}
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.6, color: "#334155", marginBottom: 10 }}>
          {MOCK.spotlightBody}
        </div>
        <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 8 }}>1 / 3</div>
        <button style={{
          width: "100%", padding: "8px",
          background: `linear-gradient(135deg,${primaryColor},${secondaryColor})`,
          color: "#fff", border: "none", borderRadius: borderRadius,
          fontSize: 12, fontWeight: 600, cursor: "pointer",
        }}>Suivant →</button>
      </div>
    </div>
  );
}

function TooltipPreview({ cfg }: { cfg: AppearanceConfig }) {
  const { tooltip, primaryColor, borderRadius, fontFamily } = cfg;
  const ff = fontFamily === "system" ? "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" : fontFamily;

  return (
    <div className="w-full rounded-xl border border-slate-100 bg-slate-50 relative min-h-[130px] flex flex-col items-center justify-center gap-4 p-4">
      <div className="text-[10px] font-medium text-slate-400 absolute top-2 left-3 select-none">Aperçu — Tooltip &amp; Highlight</div>
      <button style={{
        padding: "8px 20px", background: "transparent",
        border: `2px solid ${primaryColor}`, borderRadius: borderRadius,
        color: primaryColor, fontSize: 13, fontWeight: 600, cursor: "pointer",
        boxShadow: `0 0 0 4px ${primaryColor}33`,
        animation: "onboarder-pulse 1.5s infinite",
      }}>
        Paramètres avancés
      </button>
      <div style={{
        maxWidth: tooltip.maxWidth, background: tooltip.background,
        color: tooltip.textColor, padding: "7px 11px",
        borderRadius: borderRadius, fontSize: tooltip.fontSize,
        lineHeight: 1.55, fontFamily: ff,
        boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
      }}>
        {MOCK.tooltipText}
      </div>
    </div>
  );
}

function HotspotPreview({ cfg }: { cfg: AppearanceConfig }) {
  const { hotspot, primaryColor, borderRadius, fontFamily } = cfg;
  const ff = fontFamily === "system" ? "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" : fontFamily;

  return (
    <div className="w-full rounded-xl border border-slate-100 bg-white relative min-h-[140px] flex items-center justify-center gap-8 p-4">
      <div className="text-[10px] font-medium text-slate-400 absolute top-2 left-3 select-none">Aperçu — Hotspot</div>
      {/* Fake UI zone */}
      <div className="relative">
        <div style={{
          padding: "10px 18px", background: "#f8fafc",
          borderRadius: borderRadius, border: "1px solid #e2e8f0",
          fontSize: 13, color: "#475569",
        }}>Bouton d&apos;action</div>
        {/* Hotspot dot */}
        <div style={{
          position: "absolute", top: -6, right: -6,
          width: hotspot.size, height: hotspot.size,
          borderRadius: "50%", background: primaryColor,
          boxShadow: `0 0 0 ${hotspot.size / 3}px ${primaryColor}33`,
          cursor: "pointer",
        }} />
      </div>
      {/* Tooltip popup */}
      <div style={{
        width: Math.min(hotspot.tipWidth, 200),
        background: "#1e293b", color: "#f8fafc",
        borderRadius: borderRadius, padding: "8px 10px",
        fontSize: 12, lineHeight: 1.55, fontFamily: ff,
        boxShadow: "0 6px 24px rgba(0,0,0,0.25)",
      }}>
        <strong style={{ display: "block", marginBottom: 3, color: "#f8fafc" }}>Nouvelle action</strong>
        Déclenchez un flow directement depuis ce bouton.
      </div>
    </div>
  );
}

function ChecklistPreview({ cfg }: { cfg: AppearanceConfig }) {
  const { checklist, primaryColor, secondaryColor, borderRadius, fontFamily } = cfg;
  const ff = fontFamily === "system" ? "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" : fontFamily;
  const done  = MOCK.checkItems.filter(i => i.done).length;
  const total = MOCK.checkItems.length;
  const pct   = Math.round((done / total) * 100);

  return (
    <div className="w-full rounded-xl border border-slate-100 bg-slate-50 relative min-h-[200px] flex justify-end p-4">
      <div className="text-[10px] font-medium text-slate-400 absolute top-2 left-3 select-none">Aperçu — Checklist</div>
      <div style={{
        width: Math.min(checklist.width, 260), background: "#fff",
        borderRadius: borderRadius + 6, overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0,0,0,0.14)", fontFamily: ff,
        maxHeight: Math.min(checklist.maxHeight, 300),
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          background: `linear-gradient(135deg,${primaryColor},${secondaryColor})`,
          padding: "12px 14px", color: "#fff",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: checklist.showProgress ? 8 : 0 }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{MOCK.checkTitle}</span>
            <span style={{ fontSize: 10, opacity: 0.8 }}>{done}/{total}</span>
          </div>
          {checklist.showProgress && (
            <div style={{ height: 4, background: "rgba(255,255,255,0.3)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: "#fff", borderRadius: 2 }} />
            </div>
          )}
        </div>
        {/* Items */}
        <div style={{ overflow: "auto", flex: 1 }}>
          {MOCK.checkItems.map((item, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 12px", borderBottom: "1px solid #f1f5f9",
              opacity: item.done ? 0.55 : 1,
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10,
                background: item.done ? primaryColor : "transparent",
                color: item.done ? "#fff" : "transparent",
                border: item.done ? "none" : "2px solid #e2e8f0",
              }}>{item.done ? "✓" : ""}</div>
              <span style={{
                fontSize: 12, color: item.done ? "#94a3b8" : "#1e293b",
                textDecoration: item.done ? "line-through" : "none",
                fontWeight: item.done ? 400 : 500,
              }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PillPreview({ cfg }: { cfg: AppearanceConfig }) {
  const { pill, primaryColor, secondaryColor, fontFamily } = cfg;
  const ff = fontFamily === "system" ? "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" : fontFamily;

  const justifyMap: Record<string, string> = {
    "top-center": "center", "top-right": "flex-end", "bottom-center": "center",
  };

  return (
    <div className="w-full rounded-xl border border-slate-100 bg-slate-100 relative min-h-[80px] flex items-start justify-center p-3">
      <div className="text-[10px] font-medium text-slate-400 absolute top-2 left-3 select-none">Aperçu — Progress Pill</div>
      <div style={{ display: "flex", justifyContent: justifyMap[pill.position] ?? "center", width: "100%", paddingTop: 8 }}>
        <div style={{
          background: "#1e293b", color: "#f8fafc",
          borderRadius: 100, padding: "6px 14px",
          display: "inline-flex", alignItems: "center", gap: 8,
          boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
          fontFamily: ff, fontSize: 11, fontWeight: 500, whiteSpace: "nowrap",
        }}>
          {pill.showCount && (
            <span style={{
              background: `linear-gradient(135deg,${primaryColor},${secondaryColor})`,
              color: "#fff", borderRadius: 100, padding: "2px 7px",
              fontSize: 10, fontWeight: 700,
            }}>2 / 5</span>
          )}
          <span style={{ color: "#cbd5e1", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
            Onboarding guidé
          </span>
          <div style={{ width: pill.barWidth, height: 4, background: "#334155", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: "40%", height: "100%", background: primaryColor, borderRadius: 2 }} />
          </div>
          <span style={{ color: "#94a3b8", cursor: "pointer" }}>✕</span>
        </div>
      </div>
    </div>
  );
}

// ─── Settings panels ──────────────────────────────────────────────────────────

function BannerSettings({ cfg, onChange }: { cfg: AppearanceConfig; onChange: (c: AppearanceConfig) => void }) {
  const upd = <K extends keyof AppearanceConfig["banner"]>(k: K, v: AppearanceConfig["banner"][K]) =>
    onChange({ ...cfg, banner: { ...cfg.banner, [k]: v } });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Style" value={cfg.banner.style}
          options={[
            { value: "info",    label: "Info (bleu)" },
            { value: "warning", label: "Avertissement (jaune)" },
            { value: "success", label: "Succès (vert)" },
            { value: "promo",   label: "Promo (gradient)" },
          ]}
          onChange={v => upd("style", v as AppearanceConfig["banner"]["style"])} />
        <SelectField label="Position" value={cfg.banner.position}
          options={[{ value: "top", label: "Haut" }, { value: "bottom", label: "Bas" }]}
          onChange={v => upd("position", v as "top" | "bottom")} />
      </div>
      <SliderField label="Taille du texte" value={cfg.banner.fontSize} min={11} max={18} unit="px"
        onChange={v => upd("fontSize", v)} />
      <SliderField label="Espacement vertical" value={cfg.banner.paddingY} min={6} max={20} unit="px"
        onChange={v => upd("paddingY", v)} />
      <ToggleField label="Icône visible" value={cfg.banner.iconVisible}
        onChange={v => upd("iconVisible", v)} />
      <ToggleField label="Bouton fermer" value={cfg.banner.dismissible}
        onChange={v => upd("dismissible", v)} />
    </div>
  );
}

function ModalSettings({ cfg, onChange }: { cfg: AppearanceConfig; onChange: (c: AppearanceConfig) => void }) {
  const upd = <K extends keyof AppearanceConfig["modal"]>(k: K, v: AppearanceConfig["modal"][K]) =>
    onChange({ ...cfg, modal: { ...cfg.modal, [k]: v } });

  return (
    <div className="space-y-4">
      <SliderField label="Largeur max" value={cfg.modal.maxWidth} min={320} max={640} step={10} unit="px"
        onChange={v => upd("maxWidth", v)} />
      <SliderField label="Opacité de l'overlay" value={cfg.modal.overlayOpacity} min={20} max={85} unit="%"
        onChange={v => upd("overlayOpacity", v)} />
      <SliderField label="Hauteur max média" value={cfg.modal.mediaHeight} min={100} max={320} step={10} unit="px"
        onChange={v => upd("mediaHeight", v)} />
      <ToggleField label="CTA pleine largeur" value={cfg.modal.ctaFullWidth}
        onChange={v => upd("ctaFullWidth", v)} />
      <ToggleField label="Fermer sur backdrop" value={cfg.modal.closeOnBackdrop}
        onChange={v => upd("closeOnBackdrop", v)} />
    </div>
  );
}

function SpotlightSettings({ cfg, onChange }: { cfg: AppearanceConfig; onChange: (c: AppearanceConfig) => void }) {
  const upd = <K extends keyof AppearanceConfig["spotlight"]>(k: K, v: AppearanceConfig["spotlight"][K]) =>
    onChange({ ...cfg, spotlight: { ...cfg.spotlight, [k]: v } });

  return (
    <div className="space-y-4">
      <SliderField label="Opacité overlay" value={cfg.spotlight.overlayOpacity} min={20} max={90} unit="%"
        onChange={v => upd("overlayOpacity", v)} />
      <SliderField label="Largeur de la carte" value={cfg.spotlight.cardWidth} min={240} max={440} step={10} unit="px"
        onChange={v => upd("cardWidth", v)} />
      <SliderField label="Opacité du halo" value={cfg.spotlight.ringOpacity} min={5} max={60} unit="%"
        onChange={v => upd("ringOpacity", v)} />
      <ColorField label="Couleur du contour" value={cfg.spotlight.ringColor}
        onChange={v => upd("ringColor", v)} />
      <ToggleField label="Flèche indicatrice" value={cfg.spotlight.arrowVisible}
        onChange={v => upd("arrowVisible", v)} />
    </div>
  );
}

function TooltipSettings({ cfg, onChange }: { cfg: AppearanceConfig; onChange: (c: AppearanceConfig) => void }) {
  const upd = <K extends keyof AppearanceConfig["tooltip"]>(k: K, v: AppearanceConfig["tooltip"][K]) =>
    onChange({ ...cfg, tooltip: { ...cfg.tooltip, [k]: v } });

  return (
    <div className="space-y-4">
      <ColorField label="Fond" value={cfg.tooltip.background} onChange={v => upd("background", v)} />
      <ColorField label="Texte" value={cfg.tooltip.textColor} onChange={v => upd("textColor", v)} />
      <SliderField label="Taille du texte" value={cfg.tooltip.fontSize} min={10} max={18} unit="px"
        onChange={v => upd("fontSize", v)} />
      <SliderField label="Largeur max" value={cfg.tooltip.maxWidth} min={160} max={420} step={10} unit="px"
        onChange={v => upd("maxWidth", v)} />
    </div>
  );
}

function HotspotSettings({ cfg, onChange }: { cfg: AppearanceConfig; onChange: (c: AppearanceConfig) => void }) {
  const upd = <K extends keyof AppearanceConfig["hotspot"]>(k: K, v: AppearanceConfig["hotspot"][K]) =>
    onChange({ ...cfg, hotspot: { ...cfg.hotspot, [k]: v } });

  return (
    <div className="space-y-4">
      <SliderField label="Taille du point" value={cfg.hotspot.size} min={8} max={24} unit="px"
        onChange={v => upd("size", v)} />
      <SliderField label="Largeur du tooltip" value={cfg.hotspot.tipWidth} min={140} max={320} step={10} unit="px"
        onChange={v => upd("tipWidth", v)} />
    </div>
  );
}

function ChecklistSettings({ cfg, onChange }: { cfg: AppearanceConfig; onChange: (c: AppearanceConfig) => void }) {
  const upd = <K extends keyof AppearanceConfig["checklist"]>(k: K, v: AppearanceConfig["checklist"][K]) =>
    onChange({ ...cfg, checklist: { ...cfg.checklist, [k]: v } });

  return (
    <div className="space-y-4">
      <SliderField label="Largeur" value={cfg.checklist.width} min={220} max={400} step={10} unit="px"
        onChange={v => upd("width", v)} />
      <SliderField label="Hauteur max des items" value={cfg.checklist.maxHeight} min={160} max={500} step={20} unit="px"
        onChange={v => upd("maxHeight", v)} />
      <SelectField label="Position" value={cfg.checklist.position}
        options={[
          { value: "bottom-right", label: "Bas droite" },
          { value: "bottom-left",  label: "Bas gauche" },
        ]}
        onChange={v => upd("position", v as "bottom-right" | "bottom-left")} />
      <ToggleField label="Barre de progression" value={cfg.checklist.showProgress}
        onChange={v => upd("showProgress", v)} />
      <ToggleField label="Réduire quand tout est fait" value={cfg.checklist.collapseOnDone}
        onChange={v => upd("collapseOnDone", v)} />
    </div>
  );
}

function PillSettings({ cfg, onChange }: { cfg: AppearanceConfig; onChange: (c: AppearanceConfig) => void }) {
  const upd = <K extends keyof AppearanceConfig["pill"]>(k: K, v: AppearanceConfig["pill"][K]) =>
    onChange({ ...cfg, pill: { ...cfg.pill, [k]: v } });

  return (
    <div className="space-y-4">
      <SelectField label="Position" value={cfg.pill.position}
        options={[
          { value: "top-center",    label: "Haut centre" },
          { value: "top-right",     label: "Haut droite" },
          { value: "bottom-center", label: "Bas centre" },
        ]}
        onChange={v => upd("position", v as AppearanceConfig["pill"]["position"])} />
      <SliderField label="Largeur de la barre" value={cfg.pill.barWidth} min={30} max={120} step={5} unit="px"
        onChange={v => upd("barWidth", v)} />
      <ToggleField label="Afficher compteur étapes" value={cfg.pill.showCount}
        onChange={v => upd("showCount", v)} />
    </div>
  );
}

// ─── Preview router ───────────────────────────────────────────────────────────

function PreviewPanel({ component, cfg }: { component: ComponentKey; cfg: AppearanceConfig }) {
  switch (component) {
    case "banner":    return <BannerPreview    cfg={cfg} />;
    case "modal":     return <ModalPreview     cfg={cfg} />;
    case "spotlight": return <SpotlightPreview cfg={cfg} />;
    case "tooltip":   return <TooltipPreview   cfg={cfg} />;
    case "hotspot":   return <HotspotPreview   cfg={cfg} />;
    case "checklist": return <ChecklistPreview cfg={cfg} />;
    case "pill":      return <PillPreview      cfg={cfg} />;
  }
}

function SettingsPanel({ component, cfg, onChange }: {
  component: ComponentKey; cfg: AppearanceConfig; onChange: (c: AppearanceConfig) => void;
}) {
  switch (component) {
    case "banner":    return <BannerSettings    cfg={cfg} onChange={onChange} />;
    case "modal":     return <ModalSettings     cfg={cfg} onChange={onChange} />;
    case "spotlight": return <SpotlightSettings cfg={cfg} onChange={onChange} />;
    case "tooltip":   return <TooltipSettings   cfg={cfg} onChange={onChange} />;
    case "hotspot":   return <HotspotSettings   cfg={cfg} onChange={onChange} />;
    case "checklist": return <ChecklistSettings cfg={cfg} onChange={onChange} />;
    case "pill":      return <PillSettings      cfg={cfg} onChange={onChange} />;
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  value   : AppearanceConfig;
  onChange: (c: AppearanceConfig) => void;
}

export function AppearanceTab({ value, onChange }: Props) {
  const [active, setActive] = useState<ComponentKey>("banner");

  return (
    <div className="space-y-5">

      {/* ── Global tokens ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="w-7 h-7 bg-white rounded-lg border border-slate-200 flex items-center justify-center shadow-sm">
            <Palette className="w-3.5 h-3.5 text-violet-600" />
          </div>
          <h2 className="text-sm font-semibold text-slate-800">Tokens globaux</h2>
          <span className="ml-auto text-[10px] text-slate-400">Appliqués à tous les composants</span>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <ColorField label="Couleur primaire" value={value.primaryColor}
              onChange={v => onChange({ ...value, primaryColor: v })} />
            <ColorField label="Couleur secondaire" value={value.secondaryColor}
              onChange={v => onChange({ ...value, secondaryColor: v })} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <SelectField label="Police" value={value.fontFamily}
              options={[
                { value: "system",    label: "Système" },
                { value: "Inter",     label: "Inter" },
                { value: "DM Sans",   label: "DM Sans" },
                { value: "Roboto",    label: "Roboto" },
                { value: "Open Sans", label: "Open Sans" },
              ]}
              onChange={v => onChange({ ...value, fontFamily: v })} />
            <SelectField label="Ombres" value={value.shadowStrength}
              options={[
                { value: "none", label: "Aucune" },
                { value: "sm",   label: "Légère" },
                { value: "md",   label: "Normale" },
                { value: "lg",   label: "Forte" },
              ]}
              onChange={v => onChange({ ...value, shadowStrength: v as AppearanceConfig["shadowStrength"] })} />
            <div>
              <SliderField label="Rayon des bordures" value={value.borderRadius} min={0} max={24} unit="px"
                onChange={v => onChange({ ...value, borderRadius: v })} />
            </div>
          </div>
          <div className="mt-4">
            <ToggleField label="Activer les animations"
              value={value.animationsOn}
              onChange={v => onChange({ ...value, animationsOn: v })} />
          </div>
        </div>
      </div>

      {/* ── Component selector ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="w-7 h-7 bg-white rounded-lg border border-slate-200 flex items-center justify-center shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-violet-600" />
          </div>
          <h2 className="text-sm font-semibold text-slate-800">Composants SDK</h2>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-slate-100 overflow-x-auto scrollbar-hide px-2 pt-1">
          {COMPONENTS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
                active === id
                  ? "border-violet-600 text-violet-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>

        {/* Split: preview left, settings right */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-0 divide-y xl:divide-y-0 xl:divide-x divide-slate-100">
          {/* Preview */}
          <div className="p-5">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
              Aperçu en direct
            </p>
            <PreviewPanel component={active} cfg={value} />
          </div>

          {/* Settings */}
          <div className="p-5">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
              Paramètres
            </p>
            <SettingsPanel component={active} cfg={value} onChange={onChange} />
          </div>
        </div>
      </div>
    </div>
  );
}
