"use client";

import { useEffect, useState, useRef } from "react";
import { useParams }                    from "next/navigation";
import { createClient }                 from "@/lib/supabase";
import {
  Save, Settings2, Database, FileText, FlaskConical,
  Github, Globe, Layers, CheckCircle2, Send, Bot,
  Brain, Sliders, Ticket, Palette, Shield, Clock,
  ChevronRight, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AppearanceTab, DEFAULT_APPEARANCE } from "./AppearanceTab";
import type { AppearanceConfig } from "./AppearanceTab";

const supabase = createClient();

type Tab = "config" | "advanced" | "appearance" | "data" | "instructions" | "test";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "config",       label: "Général",      icon: Settings2    },
  { id: "advanced",     label: "Avancé",       icon: Brain        },
  { id: "appearance",   label: "Apparence",    icon: Palette      },
  { id: "data",         label: "Données",      icon: Database     },
  { id: "instructions", label: "Instructions", icon: FileText     },
  { id: "test",         label: "Test",         icon: FlaskConical },
];

interface ProjectData {
  name: string; url: string; status: string;
  chunk_count: number; routes_crawled: string[];
  config: Record<string, unknown>; instructions?: string;
}
interface Source { id: string; provider: string; label: string; status: string; files_scanned: number }
interface Msg { role: "user" | "assistant"; content: string }

// ── Tooltip ──────────────────────────────────────────────────────────────────
function Tip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex ml-1" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <Info className="w-3 h-3 text-slate-300 cursor-help" />
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-56 bg-slate-800 text-white text-[11px] leading-relaxed rounded-lg px-3 py-2 z-50 shadow-xl pointer-events-none">
          {text}
        </span>
      )}
    </span>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100 bg-slate-50/50">
        <div className="w-7 h-7 bg-white rounded-lg border border-slate-200 flex items-center justify-center shadow-sm">
          <Icon className="w-3.5 h-3.5 text-violet-600" />
        </div>
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </div>
  );
}

// ── Label helper ─────────────────────────────────────────────────────────────
function Label({ children, tip }: { children: React.ReactNode; tip?: string }) {
  return (
    <label className="flex items-center text-xs font-medium text-slate-600 mb-1.5">
      {children}{tip && <Tip text={tip} />}
    </label>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ value, onChange, label, sub }: { value: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={cn(
          "relative w-10 h-5.5 rounded-full transition-colors shrink-0",
          value ? "bg-violet-600" : "bg-slate-200"
        )}
        style={{ height: 22, width: 40 }}
      >
        <span className={cn(
          "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform",
          value ? "translate-x-5" : "translate-x-0.5"
        )} />
      </button>
    </div>
  );
}

// ── Range slider ─────────────────────────────────────────────────────────────
function RangeField({ label, tip, value, min, max, step = 1, format, onChange }: {
  label: string; tip?: string; value: number; min: number; max: number; step?: number;
  format?: (v: number) => string; onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <Label tip={tip}>{label}</Label>
        <span className="text-xs font-mono font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-md">
          {format ? format(value) : value}
        </span>
      </div>
      <div className="relative">
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #7c3aed ${pct}%, #e2e8f0 ${pct}%)`,
          }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-400 mt-1">
        <span>{format ? format(min) : min}</span>
        <span>{format ? format(max) : max}</span>
      </div>
    </div>
  );
}

export default function ConfigPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [tab,     setTab]     = useState<Tab>("config");
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [instructions, setInstructions] = useState("");
  const [savingInstr,  setSavingInstr]  = useState(false);
  const [savedInstr,   setSavedInstr]   = useState(false);

  // ── General config ──────────────────────────────────────────────────────
  const [config, setConfig] = useState({
    // Identity
    agentName:    "Assistant",
    agentEmoji:   "🤖",
    tone:         "friendly",
    locale:       "fr",
    // Widget appearance
    primaryColor:    "#6366f1",
    widgetPosition:  "bottom-right",
    widgetSize:      "medium",
    welcomeMessage:  "",
    avatarUrl:       "",
    poweredByHidden: false,
    // Proactive
    proactiveEnabled:  true,
    proactiveDelayMs:  90000,
    proactiveMessage:  "",
    // Crawl
    maxPages: 30,
    // Session
    retentionDays: 90,
    maxTurns:      50,
    // Activation
    activationRoute: "",
  });

  // ── Advanced config ─────────────────────────────────────────────────────
  const [advanced, setAdvanced] = useState({
    // LLM
    llmModel:        "llama-3.3-70b-versatile",
    temperature:     0.3,
    maxTokens:       900,
    historyWindow:   10,
    streamingEnabled: true,
    // RAG
    similarityThreshold: 0.58,
    matchCount:          14,
    rerankBoost:         1.25,
    ragContextChunks:    10,
    // Tickets
    autoTicketEnabled:   true,
    minConfidenceTicket: 0.45,
    lowConfTurns:        2,
    defaultPriority:     "medium",
    // Security
    allowedDomains:  "",
    rateLimitPerMin: 30,
    requireAuth:     false,
    // Embedding
    embeddingModel:  "gemini-embedding-001",
    embeddingDims:   768,
    // Agent Mode
    agent_mode:      "rag",
  });

  // ── Appearance ──────────────────────────────────────────────────────────
  const [appearance, setAppearance] = useState<AppearanceConfig>(DEFAULT_APPEARANCE);

  // ── Test tab ────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input,    setInput]    = useState("");
  const [sending,  setSending]  = useState(false);
  const messagesEndRef          = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      supabase.from("onboarder_projects")
        .select("name,url,status,chunk_count,routes_crawled,config,instructions")
        .eq("id", projectId).maybeSingle(),
      supabase.from("onboarder_sources")
        .select("id,provider,label,status,files_scanned").eq("project_id", projectId),
    ]).then(([{ data: proj }, { data: src }]) => {
      if (proj) {
        setProject(proj as ProjectData);
        const c = proj.config as Record<string, unknown> | null ?? {};
        setConfig(prev => ({ ...prev, ...c }));
        setAdvanced(prev => ({ ...prev, ...c }));
        if (c.appearance) setAppearance(prev => ({ ...prev, ...(c.appearance as Partial<AppearanceConfig>) }));
        if (proj.instructions) setInstructions(proj.instructions);
      }
      setSources((src ?? []) as Source[]);
    });
  }, [projectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const saveAll = async () => {
    setSaving(true); setSaveErr(null);
    const merged = { ...config, ...advanced, appearance };
    const { error, data } = await supabase.from("onboarder_projects")
      .update({ config: merged, updated_at: new Date().toISOString() })
      .eq("id", projectId)
      .select("id")
      .single();
    setSaving(false);
    if (error) {
      console.error("[Config] save failed:", error);
      setSaveErr(error.message);
    } else {
      console.log("[Config] saved ok:", data?.id);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  };

  const saveInstructions = async () => {
    setSavingInstr(true);
    await supabase.from("onboarder_projects").update({ instructions }).eq("id", projectId);
    setSavingInstr(false); setSavedInstr(true); setTimeout(() => setSavedInstr(false), 2500);
  };

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    const userMsg: Msg = { role: "user", content: input.trim() };
    setMessages(m => [...m, userMsg]);
    setInput(""); setSending(true);
    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          "Authorization": `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        },
        body: JSON.stringify({
          projectId,
          sessionId: "test-" + projectId,
          question: userMsg.content,
          conversationHistory: history,
          uiContext: {
            currentRoute: "/dashboard/test",
            pageTitle: "Test agent",
            visibleElements: [],
          },
          userProfile: { role: "admin", plan: "test" },
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      // Parse SSE stream — extract reply from the `actions` event
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let reply = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ") && currentEvent === "actions") {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.reply) reply = parsed.reply;
            } catch { /* ignore parse errors */ }
          } else if (line.startsWith("data: ") && currentEvent === "done") {
            break;
          }
        }
      }

      setMessages(m => [...m, { role: "assistant", content: reply || "…" }]);
    } catch {
      setMessages(m => [...m, { role: "assistant", content: "Erreur de connexion à l'agent." }]);
    }
    setSending(false);
  };

  const inputCls = "w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-50 bg-white transition-colors";
  const upd = (k: keyof typeof config) => (v: unknown) => setConfig(c => ({ ...c, [k]: v }));
  const updA = (k: keyof typeof advanced) => (v: unknown) => setAdvanced(c => ({ ...c, [k]: v }));

  return (
    <div className="flex flex-col h-full">

      {/* ── Header + tabs ──────────────────────────────────────────────── */}
      <div className="px-8 pt-7 pb-0 shrink-0">
        <h1 className="text-xl font-bold text-slate-900">Configuration</h1>
        <p className="text-sm text-slate-500 mt-0.5">Personnalisez le comportement et les paramètres de l&apos;agent.</p>
        <div className="flex gap-1 mt-5 border-b border-slate-200">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                tab === id
                  ? "border-violet-600 text-violet-700"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto px-8 py-6 space-y-5">

        {/* ══════════ TAB: GÉNÉRAL ══════════ */}
        {tab === "config" && (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

              {/* Identité */}
              <Section title="Identité de l'agent" icon={Bot}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Nom de l&apos;agent</Label>
                    <input value={config.agentName} onChange={e => upd("agentName")(e.target.value)} className={inputCls} placeholder="Assistant" />
                  </div>
                  <div>
                    <Label tip="Affiché dans la bulle de chat">Emoji avatar</Label>
                    <input value={config.agentEmoji} onChange={e => upd("agentEmoji")(e.target.value)} className={inputCls} placeholder="🤖" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label tip="Influence le style de rédaction des réponses">Ton</Label>
                    <select value={config.tone} onChange={e => upd("tone")(e.target.value)} className={inputCls}>
                      <option value="friendly">😊 Friendly</option>
                      <option value="professional">💼 Professionnel</option>
                      <option value="concise">⚡ Concis</option>
                      <option value="fun">🎉 Fun</option>
                      <option value="formal">🎩 Formel</option>
                      <option value="empathetic">🤝 Empathique</option>
                    </select>
                  </div>
                  <div>
                    <Label>Langue principale</Label>
                    <select value={config.locale} onChange={e => upd("locale")(e.target.value)} className={inputCls}>
                      <option value="fr">🇫🇷 Français</option>
                      <option value="en">🇬🇧 English</option>
                      <option value="es">🇪🇸 Español</option>
                      <option value="de">🇩🇪 Deutsch</option>
                      <option value="pt">🇵🇹 Português</option>
                      <option value="it">🇮🇹 Italiano</option>
                      <option value="nl">🇳🇱 Nederlands</option>
                      <option value="pl">🇵🇱 Polski</option>
                    </select>
                  </div>
                </div>
              </Section>

              {/* Widget */}
              <Section title="Widget & Apparence" icon={Palette}>
                {/* Live preview */}
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-xl shadow-md shrink-0"
                    style={{ background: `linear-gradient(135deg, ${config.primaryColor}, ${config.primaryColor}cc)` }}
                  >
                    {config.agentEmoji || "🤖"}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{config.agentName || "Assistant"}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {config.welcomeMessage || "Bonjour ! Comment puis-je vous aider ?"}
                    </p>
                  </div>
                  <div
                    className="ml-auto text-xs px-2 py-0.5 rounded-full text-white font-medium shrink-0"
                    style={{ background: config.primaryColor }}
                  >
                    {config.widgetPosition === "bottom-right" ? "↘" : "↙"}
                  </div>
                </div>

                <div>
                  <Label>Couleur principale</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color" value={config.primaryColor}
                      onChange={e => upd("primaryColor")(e.target.value)}
                      className="w-10 h-10 rounded-xl border border-slate-200 cursor-pointer p-1 shrink-0"
                    />
                    <input value={config.primaryColor} onChange={e => upd("primaryColor")(e.target.value)} className={cn(inputCls, "font-mono text-xs")} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label tip="Position du widget sur la page">Position</Label>
                    <select value={config.widgetPosition} onChange={e => upd("widgetPosition")(e.target.value)} className={inputCls}>
                      <option value="bottom-right">↘ Bas droite</option>
                      <option value="bottom-left">↙ Bas gauche</option>
                    </select>
                  </div>
                  <div>
                    <Label>Taille du widget</Label>
                    <select value={config.widgetSize} onChange={e => upd("widgetSize")(e.target.value)} className={inputCls}>
                      <option value="small">Compact</option>
                      <option value="medium">Moyen</option>
                      <option value="large">Large</option>
                    </select>
                  </div>
                </div>

                <div>
                  <Label tip="Premier message affiché à l'ouverture du chat. Laissez vide pour le message par défaut.">
                    Message d&apos;accueil
                  </Label>
                  <input
                    value={config.welcomeMessage}
                    onChange={e => upd("welcomeMessage")(e.target.value)}
                    placeholder={`Bonjour ! Je suis ${config.agentName || "votre assistant"}. Comment puis-je vous aider ?`}
                    className={inputCls}
                  />
                </div>

                <div>
                  <Label tip="URL d'une image à utiliser comme avatar à la place de l'emoji (optionnel)">
                    URL avatar <span className="text-slate-400 font-normal ml-1">(optionnel)</span>
                  </Label>
                  <div className="flex items-center gap-3">
                    {config.avatarUrl && (
                      <img src={config.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0" />
                    )}
                    <input
                      value={config.avatarUrl}
                      onChange={e => upd("avatarUrl")(e.target.value)}
                      placeholder="https://example.com/avatar.png"
                      className={cn(inputCls, "font-mono text-xs")}
                    />
                  </div>
                </div>

                <Toggle
                  value={config.poweredByHidden}
                  onChange={upd("poweredByHidden")}
                  label='Masquer "Propulsé par Onboarder"'
                  sub="Désactive le lien en bas du widget (plan Pro)"
                />
              </Section>

              {/* Comportement proactif */}
              <Section title="Comportement proactif" icon={Clock}>
                <Toggle
                  value={config.proactiveEnabled}
                  onChange={upd("proactiveEnabled")}
                  label="Déclenchement proactif"
                  sub="L'agent intervient automatiquement après inactivité"
                />
                <RangeField
                  label="Délai d'inactivité"
                  tip="Durée d'inactivité avant que l'agent n'intervienne"
                  value={config.proactiveDelayMs / 1000}
                  min={10} max={300} step={5}
                  format={v => `${v}s`}
                  onChange={v => upd("proactiveDelayMs")(v * 1000)}
                />
                <div>
                  <Label tip="Laissez vide pour une génération automatique par l'IA">Message proactif personnalisé</Label>
                  <input
                    value={config.proactiveMessage}
                    onChange={e => upd("proactiveMessage")(e.target.value)}
                    placeholder="Besoin d'aide ? Je suis là pour vous guider…"
                    className={inputCls}
                  />
                </div>
                <div>
                  <Label tip="Route déclenchant l'activation de la session">Route d&apos;activation</Label>
                  <input
                    value={config.activationRoute}
                    onChange={e => upd("activationRoute")(e.target.value)}
                    placeholder="/dashboard ou /onboarding"
                    className={cn(inputCls, "font-mono text-xs")}
                  />
                </div>
              </Section>

              {/* Session & Crawl */}
              <Section title="Session & Crawl" icon={Settings2}>
                <RangeField
                  label="Rétention des sessions (jours)"
                  tip="Durée de conservation des données de session"
                  value={config.retentionDays}
                  min={7} max={365}
                  format={v => `${v}j`}
                  onChange={upd("retentionDays")}
                />
                <RangeField
                  label="Nombre max de tours par session"
                  tip="Au-delà, la conversation est réinitialisée"
                  value={config.maxTurns}
                  min={5} max={200}
                  onChange={upd("maxTurns")}
                />
                <RangeField
                  label="Pages max à crawler"
                  tip="Limite du nombre de pages indexées par crawl"
                  value={config.maxPages}
                  min={5} max={500}
                  onChange={upd("maxPages")}
                />
              </Section>
            </div>

            <div className="flex items-center justify-end gap-4">
              {saveErr && (
                <span className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg">
                  Erreur : {saveErr}
                </span>
              )}
              <button onClick={saveAll} disabled={saving} className="btn-dark inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold">
                <Save className="w-4 h-4" />
                {saved ? "Sauvegardé ✓" : saving ? "Sauvegarde…" : "Sauvegarder"}
              </button>
            </div>
          </>
        )}

        {/* ══════════ TAB: AVANCÉ ══════════ */}
        {tab === "advanced" && (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

              {/* Stratégie de guidage */}
              <Section title="Stratégie de l'agent" icon={Sliders}>
                <div>
                  <Label tip="Détermine comment l'agent décide des prochaines étapes d'onboarding.">Mode de l&apos;agent</Label>
                  <div className="grid grid-cols-2 gap-3 mt-1">
                    <button
                      onClick={() => updA("agent_mode")("rag")}
                      className={cn(
                        "flex flex-col gap-2 p-3 rounded-xl border text-left transition-all",
                        advanced.agent_mode === "rag"
                          ? "border-violet-600 bg-violet-50/50 ring-2 ring-violet-100"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className={cn("text-xs font-bold uppercase tracking-wider", advanced.agent_mode === "rag" ? "text-violet-700" : "text-slate-500")}>RAG Mode</span>
                        {advanced.agent_mode === "rag" && <CheckCircle2 className="w-4 h-4 text-violet-600" />}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-normal">
                        Utilise la base de connaissances et l&apos;IA pour répondre aux questions et guider librement.
                      </p>
                    </button>

                    <button
                      onClick={() => updA("agent_mode")("deterministic")}
                      className={cn(
                        "flex flex-col gap-2 p-3 rounded-xl border text-left transition-all",
                        advanced.agent_mode === "deterministic"
                          ? "border-violet-600 bg-violet-50/50 ring-2 ring-violet-100"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className={cn("text-xs font-bold uppercase tracking-wider", advanced.agent_mode === "deterministic" ? "text-violet-700" : "text-slate-500")}>Déterministe</span>
                        {advanced.agent_mode === "deterministic" && <CheckCircle2 className="w-4 h-4 text-violet-600" />}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-normal">
                        Suit l&apos;arbre applicatif de manière structurée pour un onboarding pas-à-pas précis.
                      </p>
                    </button>
                  </div>
                </div>
              </Section>

              {/* LLM */}
              <Section title="Modèle LLM" icon={Brain}>
                <div>
                  <Label tip="Modèle utilisé pour générer les réponses (via Groq)">Modèle</Label>
                  <select value={advanced.llmModel} onChange={e => updA("llmModel")(e.target.value)} className={inputCls}>
                    <optgroup label="Llama 3.3">
                      <option value="llama-3.3-70b-versatile">Llama 3.3 70B Versatile — recommandé</option>
                      <option value="llama-3.3-70b-specdec">Llama 3.3 70B SpecDec</option>
                    </optgroup>
                    <optgroup label="Llama 3.1">
                      <option value="llama-3.1-70b-versatile">Llama 3.1 70B</option>
                      <option value="llama-3.1-8b-instant">Llama 3.1 8B Instant — rapide</option>
                    </optgroup>
                    <optgroup label="Mixtral">
                      <option value="mixtral-8x7b-32768">Mixtral 8x7B — longues conversations</option>
                    </optgroup>
                    <optgroup label="Gemma">
                      <option value="gemma2-9b-it">Gemma 2 9B</option>
                    </optgroup>
                  </select>
                </div>
                <RangeField
                  label="Température"
                  tip="0 = réponses déterministes, 1 = créativité maximale. Recommandé : 0.2–0.4 pour l'onboarding."
                  value={advanced.temperature}
                  min={0} max={1} step={0.05}
                  format={v => v.toFixed(2)}
                  onChange={updA("temperature")}
                />
                <RangeField
                  label="Tokens max par réponse"
                  tip="Limite la longueur des réponses générées"
                  value={advanced.maxTokens}
                  min={100} max={2000} step={50}
                  format={v => `${v} tok`}
                  onChange={updA("maxTokens")}
                />
                <RangeField
                  label="Fenêtre d'historique (tours)"
                  tip="Nombre de messages précédents inclus dans le contexte envoyé au LLM"
                  value={advanced.historyWindow}
                  min={2} max={30}
                  onChange={updA("historyWindow")}
                />
                <Toggle
                  value={advanced.streamingEnabled}
                  onChange={updA("streamingEnabled")}
                  label="Streaming SSE"
                  sub="Affiche les réponses token par token en temps réel"
                />
              </Section>

              {/* RAG */}
              <Section title="RAG & Recherche vectorielle" icon={Sliders}>
                <div>
                  <Label tip="Modèle utilisé pour générer les embeddings de la knowledge base">Modèle d&apos;embedding</Label>
                  <select value={advanced.embeddingModel} onChange={e => updA("embeddingModel")(e.target.value)} className={inputCls}>
                    <option value="gemini-embedding-001">Gemini Embedding 001 (768d) — recommandé</option>
                    <option value="text-embedding-004">Gemini text-embedding-004 (768d)</option>
                  </select>
                </div>
                <RangeField
                  label="Seuil de similarité cosinus"
                  tip="Score minimum pour qu'un chunk soit inclus dans le contexte. Augmenter = plus précis mais moins de résultats."
                  value={advanced.similarityThreshold}
                  min={0.3} max={0.95} step={0.01}
                  format={v => v.toFixed(2)}
                  onChange={updA("similarityThreshold")}
                />
                <RangeField
                  label="Chunks récupérés (match count)"
                  tip="Nombre de chunks candidats avant re-ranking"
                  value={advanced.matchCount}
                  min={3} max={30}
                  onChange={updA("matchCount")}
                />
                <RangeField
                  label="Chunks injectés dans le prompt"
                  tip="Nombre final de chunks après re-ranking inclus dans le contexte LLM"
                  value={advanced.ragContextChunks}
                  min={2} max={20}
                  onChange={updA("ragContextChunks")}
                />
                <RangeField
                  label="Boost re-ranking route actuelle"
                  tip="Multiplicateur de score pour les chunks de la page courante de l'utilisateur"
                  value={advanced.rerankBoost}
                  min={1.0} max={2.0} step={0.05}
                  format={v => `×${v.toFixed(2)}`}
                  onChange={updA("rerankBoost")}
                />
              </Section>

              {/* Tickets */}
              <Section title="Gestion automatique des tickets" icon={Ticket}>
                <Toggle
                  value={advanced.autoTicketEnabled}
                  onChange={updA("autoTicketEnabled")}
                  label="Création automatique de tickets"
                  sub="L'agent ouvre un ticket si la confiance est trop faible ou si l'utilisateur le demande"
                />
                <RangeField
                  label="Seuil de confiance critique"
                  tip="En dessous de ce score, une réponse est considérée à faible confiance"
                  value={advanced.minConfidenceTicket}
                  min={0.1} max={0.9} step={0.05}
                  format={v => v.toFixed(2)}
                  onChange={updA("minConfidenceTicket")}
                />
                <RangeField
                  label="Tours à faible confiance avant ticket auto"
                  tip="Nombre de réponses consécutives sous le seuil avant d'ouvrir un ticket automatiquement"
                  value={advanced.lowConfTurns}
                  min={1} max={6}
                  onChange={updA("lowConfTurns")}
                />
                <div>
                  <Label>Priorité par défaut des tickets</Label>
                  <select value={advanced.defaultPriority} onChange={e => updA("defaultPriority")(e.target.value)} className={inputCls}>
                    <option value="low">Basse</option>
                    <option value="medium">Moyenne</option>
                    <option value="high">Haute</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </Section>

              {/* Sécurité */}
              <Section title="Sécurité & Limites" icon={Shield}>
                <div>
                  <Label tip="Domaines autorisés à utiliser le widget (séparés par des virgules). Vide = tous les domaines.">Domaines autorisés (CORS)</Label>
                  <input
                    value={advanced.allowedDomains}
                    onChange={e => updA("allowedDomains")(e.target.value)}
                    placeholder="app.monsaas.com, staging.monsaas.com"
                    className={cn(inputCls, "font-mono text-xs")}
                  />
                </div>
                <RangeField
                  label="Rate limit (requêtes/minute)"
                  tip="Nombre maximum de messages qu'un utilisateur peut envoyer par minute"
                  value={advanced.rateLimitPerMin}
                  min={5} max={120}
                  format={v => `${v}/min`}
                  onChange={updA("rateLimitPerMin")}
                />
                <Toggle
                  value={advanced.requireAuth}
                  onChange={updA("requireAuth")}
                  label="Authentification requise"
                  sub="Le widget ne s'affiche qu'aux utilisateurs connectés"
                />
              </Section>
            </div>

            <div className="flex items-center justify-end gap-4">
              {saveErr && (
                <span className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg">
                  Erreur : {saveErr}
                </span>
              )}
              <button onClick={saveAll} disabled={saving} className="btn-dark inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold">
                <Save className="w-4 h-4" />
                {saved ? "Sauvegardé ✓" : saving ? "Sauvegarde…" : "Sauvegarder"}
              </button>
            </div>
          </>
        )}

        {/* ══════════ TAB: APPARENCE ══════════ */}
        {tab === "appearance" && (
          <AppearanceTab value={appearance} onChange={setAppearance} />
        )}

        {/* ══════════ TAB: DONNÉES ══════════ */}
        {tab === "data" && (
          <>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Chunks indexés",  value: project?.chunk_count ?? 0,            icon: Layers  },
                { label: "Routes crawlées", value: project?.routes_crawled?.length ?? 0, icon: Globe   },
                { label: "Sources actives", value: sources.filter(s => s.status === "ready").length, icon: Github },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
                  <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{value}</p>
                    <p className="text-xs text-slate-500">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h2 className="text-sm font-semibold text-slate-800 mb-4">Sources connectées</h2>
                {sources.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">
                    Aucune source — <a href="source" className="text-violet-600 hover:underline">en ajouter une</a>
                  </p>
                ) : (
                  <div className="space-y-2">
                    {sources.map(s => (
                      <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-50">
                        <div className={cn("w-2 h-2 rounded-full shrink-0",
                          s.status === "ready" ? "bg-emerald-500" :
                          s.status === "scanning" ? "bg-yellow-500 animate-pulse" : "bg-slate-300")} />
                        <span className="text-sm font-medium text-slate-700 flex-1 truncate">{s.label || s.provider}</span>
                        <span className="text-xs text-slate-400 font-mono capitalize">{s.provider}</span>
                        <span className="text-xs text-slate-400">{s.files_scanned ?? 0} fichiers</span>
                        {s.status === "ready" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {(project?.routes_crawled?.length ?? 0) > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h2 className="text-sm font-semibold text-slate-800 mb-4">
                    Routes crawlées <span className="text-slate-400 font-normal">({project!.routes_crawled.length})</span>
                  </h2>
                  <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto">
                    {project!.routes_crawled.map(r => (
                      <span key={r} className="flex items-center gap-1 text-xs bg-slate-100 hover:bg-violet-50 hover:text-violet-700 text-slate-600 px-2.5 py-1 rounded-lg font-mono transition-colors cursor-default">
                        <ChevronRight className="w-3 h-3 shrink-0" />{r}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ══════════ TAB: INSTRUCTIONS ══════════ */}
        {tab === "instructions" && (
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">Prompt système personnalisé</h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Instructions injectées avant chaque conversation. Définissez le persona, les contraintes, les règles métier et le périmètre de l&apos;agent.
                  Ces instructions s&apos;ajoutent au prompt système généré automatiquement.
                </p>
              </div>
              <textarea
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                rows={18}
                placeholder={`Exemple :\nTu es ${config.agentName}, assistant intégré dans ${project?.name ?? "l'application"}.\n\nRègles :\n- Réponds toujours en ${config.locale === "fr" ? "français" : "anglais"}, avec un ton ${config.tone}.\n- Ne fournis jamais d'informations sur les prix sans consulter l'équipe commerciale.\n- Si l'utilisateur évoque un bug, ouvre systématiquement un ticket.\n- Ne parle jamais de la concurrence.\n\nPérimètre :\n- Tu guides uniquement sur les fonctionnalités de ${project?.name ?? "l'app"}.\n- Pour les questions de facturation, redirige vers support@exemple.com.`}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-50 font-mono resize-none leading-relaxed transition-colors"
              />
              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-slate-400">{instructions.length} caractères</p>
                <button onClick={saveInstructions} disabled={savingInstr} className="btn-dark inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold">
                  <Save className="w-4 h-4" />
                  {savedInstr ? "Sauvegardé ✓" : savingInstr ? "Sauvegarde…" : "Sauvegarder"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ TAB: TEST ══════════ */}
        {tab === "test" && (
          <div className="flex gap-5 h-[600px]">
            {/* Chat */}
            <div className="flex-1 bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 shrink-0">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xl shrink-0" style={{ background: config.primaryColor + "20" }}>
                  {config.agentEmoji}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800">{config.agentName}</p>
                  <p className="text-xs text-slate-400">Mode test — {project?.name}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-xs text-slate-400">En ligne</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <Bot className="w-12 h-12 text-slate-200 mb-3" />
                    <p className="text-sm text-slate-400">Envoyez un message pour tester l&apos;agent.</p>
                    <p className="text-xs text-slate-300 mt-1">Les réponses utilisent la Knowledge Base réelle.</p>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={cn("flex gap-2.5", m.role === "user" ? "flex-row-reverse" : "")}>
                    {m.role === "assistant" && (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0 mt-0.5" style={{ background: config.primaryColor + "20" }}>
                        {config.agentEmoji}
                      </div>
                    )}
                    <div className={cn(
                      "max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed",
                      m.role === "user"
                        ? "text-white rounded-tr-sm"
                        : "bg-slate-100 text-slate-800 rounded-tl-sm"
                    )}
                    style={m.role === "user" ? { background: config.primaryColor } : {}}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex gap-2.5">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0" style={{ background: config.primaryColor + "20" }}>
                      {config.agentEmoji}
                    </div>
                    <div className="bg-slate-100 px-4 py-3 rounded-2xl rounded-tl-sm">
                      <span className="flex gap-1 items-center">
                        {[0, 150, 300].map(d => (
                          <span key={d} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                        ))}
                      </span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="px-4 py-3 border-t border-slate-100 shrink-0">
                <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-50 transition-all">
                  <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder="Envoyer un message…"
                    className="flex-1 bg-transparent text-sm outline-none text-slate-800 placeholder-slate-400"
                    disabled={sending}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() || sending}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-white disabled:opacity-40 transition-opacity"
                    style={{ background: config.primaryColor }}
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Config summary panel */}
            <div className="w-64 bg-white rounded-xl border border-slate-200 p-5 space-y-4 overflow-y-auto shrink-0">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Paramètres actifs</h3>
              {[
                { label: "Modèle",       value: advanced.llmModel.split("-").slice(0, 3).join("-") },
                { label: "Temp.",        value: advanced.temperature.toFixed(2) },
                { label: "Max tokens",   value: advanced.maxTokens },
                { label: "Historique",   value: `${advanced.historyWindow} tours` },
                { label: "Similarité",   value: advanced.similarityThreshold.toFixed(2) },
                { label: "Chunks RAG",   value: `${advanced.ragContextChunks}/${advanced.matchCount}` },
                { label: "Seuil ticket", value: advanced.minConfidenceTicket.toFixed(2) },
                { label: "Ton",          value: config.tone },
                { label: "Langue",       value: config.locale.toUpperCase() },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-500">{label}</span>
                  <span className="text-xs font-semibold text-slate-800 font-mono truncate max-w-[100px] text-right">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
