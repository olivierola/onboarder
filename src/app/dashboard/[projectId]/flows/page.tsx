"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams }                        from "next/navigation";
import {
  Plus, Workflow, Pencil, Trash2, ChevronDown, ChevronUp,
  GripVertical, X, Check, Play, Archive, FileText,
} from "lucide-react";

/* ─────────────────────────── Types ─────────────────────────── */

type TriggerType = "manual" | "route" | "event" | "segment";
type FlowStatus  = "draft" | "active" | "archived";

interface Step {
  id:      string;
  type:    "message" | "tooltip" | "highlight" | "redirect" | "wait";
  title:   string;
  content: string;
  target?: string;   // CSS selector or URL
  delay?:  number;   // ms
}

interface Flow {
  id:             string;
  name:           string;
  description:    string | null;
  trigger_type:   TriggerType;
  trigger_config: Record<string, unknown>;
  steps:          Step[];
  status:         FlowStatus;
  created_at:     string;
}

/* ─────────────────────────── Helpers ───────────────────────── */

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY      = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const FLOWS_URL     = `${SUPABASE_URL}/functions/v1/flows`;

async function apiFetch(input: RequestInfo, init?: RequestInit) {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", apikey: ANON_KEY, ...(init?.headers ?? {}) },
  });
  return res.json();
}

const STEP_TYPES: { value: Step["type"]; label: string }[] = [
  { value: "message",   label: "Message"   },
  { value: "tooltip",   label: "Tooltip"   },
  { value: "highlight", label: "Highlight" },
  { value: "redirect",  label: "Redirect"  },
  { value: "wait",      label: "Attente"   },
];

const TRIGGER_LABELS: Record<TriggerType, string> = {
  manual:  "Manuel",
  route:   "Route URL",
  event:   "Événement",
  segment: "Segment",
};

const STATUS_STYLES: Record<FlowStatus, string> = {
  draft:    "bg-amber-50 text-amber-700 border-amber-200",
  active:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  archived: "bg-slate-100 text-slate-500 border-slate-200",
};

const STATUS_LABELS: Record<FlowStatus, string> = {
  draft: "Brouillon", active: "Actif", archived: "Archivé",
};

function uid() { return Math.random().toString(36).slice(2, 10); }

const inputCls =
  "border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-50 outline-none transition w-full bg-white";

/* ─────────────────────────── Step editor ───────────────────── */

function StepCard({
  step, index, total,
  onChange, onDelete, onMove,
}: {
  step: Step; index: number; total: number;
  onChange: (s: Step) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const [open, setOpen] = useState(index === 0);

  return (
    <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden">
      {/* header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100">
        <GripVertical className="w-4 h-4 text-slate-300 shrink-0" />
        <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center shrink-0">
          {index + 1}
        </span>
        <span className="flex-1 text-sm font-medium text-slate-700 truncate">
          {step.title || `Étape ${index + 1}`}
        </span>
        <span className="text-xs text-slate-400 capitalize">{STEP_TYPES.find(t => t.value === step.type)?.label}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => onMove(-1)} disabled={index === 0}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 disabled:opacity-25 transition">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onMove(1)} disabled={index === total - 1}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 disabled:opacity-25 transition">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setOpen(o => !o)}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition">
            {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button onClick={onDelete}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* body */}
      {open && (
        <div className="p-4 grid grid-cols-2 gap-3">
          {/* type */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
            <select value={step.type} onChange={e => onChange({ ...step, type: e.target.value as Step["type"] })}
              className={inputCls}>
              {STEP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {/* title */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Titre</label>
            <input value={step.title} onChange={e => onChange({ ...step, title: e.target.value })}
              placeholder="Titre de l'étape" className={inputCls} />
          </div>
          {/* content */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">Contenu</label>
            <textarea value={step.content} onChange={e => onChange({ ...step, content: e.target.value })}
              rows={3} placeholder="Texte affiché à l'utilisateur…"
              className={inputCls + " resize-none"} />
          </div>
          {/* target */}
          {(step.type === "tooltip" || step.type === "highlight" || step.type === "redirect") && (
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">
                {step.type === "redirect" ? "URL de redirection" : "Sélecteur CSS"}
              </label>
              <input value={step.target ?? ""} onChange={e => onChange({ ...step, target: e.target.value })}
                placeholder={step.type === "redirect" ? "/dashboard/overview" : "#onboarding-btn"}
                className={inputCls} />
            </div>
          )}
          {/* delay */}
          {step.type === "wait" && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Délai (ms)</label>
              <input type="number" min={0} value={step.delay ?? 1000}
                onChange={e => onChange({ ...step, delay: Number(e.target.value) })}
                className={inputCls} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Flow modal ───────────────────── */

function FlowModal({
  projectId, flow, onClose, onSaved,
}: {
  projectId: string;
  flow: Flow | null;
  onClose: () => void;
  onSaved: (f: Flow) => void;
}) {
  const isEdit = !!flow;
  const [name,        setName]        = useState(flow?.name ?? "");
  const [description, setDescription] = useState(flow?.description ?? "");
  const [triggerType, setTriggerType] = useState<TriggerType>(flow?.trigger_type ?? "manual");
  const [triggerVal,  setTriggerVal]  = useState(
    (flow?.trigger_config as { value?: string })?.value ?? ""
  );
  const [steps,       setSteps]       = useState<Step[]>(flow?.steps ?? []);
  const [status,      setStatus]      = useState<FlowStatus>(flow?.status ?? "draft");
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");

  function addStep() {
    setSteps(prev => [...prev, { id: uid(), type: "message", title: "", content: "" }]);
  }

  function updateStep(i: number, s: Step) {
    setSteps(prev => prev.map((p, idx) => idx === i ? s : p));
  }

  function deleteStep(i: number) {
    setSteps(prev => prev.filter((_, idx) => idx !== i));
  }

  function moveStep(i: number, dir: -1 | 1) {
    setSteps(prev => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function save() {
    if (!name.trim()) { setError("Le nom est requis."); return; }
    setSaving(true);
    setError("");

    const body = {
      project_id:     projectId,
      name:           name.trim(),
      description:    description.trim() || null,
      trigger_type:   triggerType,
      trigger_config: triggerVal ? { value: triggerVal } : {},
      steps,
      status,
    };

    const result = isEdit
      ? await apiFetch(`${FLOWS_URL}?id=${flow!.id}`, { method: "PUT", body: JSON.stringify(body) })
      : await apiFetch(FLOWS_URL, { method: "POST", body: JSON.stringify(body) });

    setSaving(false);
    if (result.error) { setError(result.error); return; }
    onSaved(result.flow);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white shadow-2xl w-full max-w-2xl h-screen flex flex-col overflow-hidden">

        {/* Sidebar header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
            <Workflow className="w-5 h-5 text-violet-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-slate-900">
              {isEdit ? "Modifier le flow" : "Nouveau flow"}
            </h2>
            <p className="text-xs text-slate-400">Définissez les étapes de votre onboarding personnalisé</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sidebar body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Name + Status */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">Nom *</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Onboarding nouveaux utilisateurs"
                className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Statut</label>
              <select value={status} onChange={e => setStatus(e.target.value as FlowStatus)} className={inputCls}>
                <option value="draft">Brouillon</option>
                <option value="active">Actif</option>
                <option value="archived">Archivé</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Description optionnelle…" className={inputCls} />
          </div>

          {/* Trigger */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Déclencheur</label>
              <select value={triggerType} onChange={e => setTriggerType(e.target.value as TriggerType)} className={inputCls}>
                <option value="manual">Manuel</option>
                <option value="route">Route URL</option>
                <option value="event">Événement JS</option>
                <option value="segment">Segment utilisateur</option>
              </select>
            </div>
            {triggerType !== "manual" && (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  {triggerType === "route"   ? "Pattern URL"        :
                   triggerType === "event"   ? "Nom de l'événement" :
                                               "Nom du segment"}
                </label>
                <input value={triggerVal} onChange={e => setTriggerVal(e.target.value)}
                  placeholder={
                    triggerType === "route"   ? "/onboarding/*" :
                    triggerType === "event"   ? "user_signed_up"  :
                                               "new_user"
                  }
                  className={inputCls} />
              </div>
            )}
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-slate-700">
                Étapes <span className="text-slate-400 font-normal">({steps.length})</span>
              </p>
              <button onClick={addStep}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 transition">
                <Plus className="w-3.5 h-3.5" /> Ajouter une étape
              </button>
            </div>

            {steps.length === 0 ? (
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
                <Workflow className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Aucune étape. Ajoutez-en une pour commencer.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {steps.map((step, i) => (
                  <StepCard
                    key={step.id}
                    step={step}
                    index={i}
                    total={steps.length}
                    onChange={s => updateStep(i, s)}
                    onDelete={() => deleteStep(i)}
                    onMove={dir => moveStep(i, dir)}
                  />
                ))}
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">{error}</p>
          )}
        </div>

        {/* Sidebar footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-200 transition">
            Annuler
          </button>
          <button onClick={save} disabled={saving}
            className="btn-dark flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60 transition">
            {saving ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            {isEdit ? "Enregistrer" : "Créer le flow"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Flow card ───────────────────────── */

function FlowCard({
  flow, onEdit, onDelete,
}: {
  flow: Flow;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-violet-200 hover:shadow-sm transition-all group">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0 group-hover:bg-violet-100 transition-colors">
          <Workflow className="w-5 h-5 text-violet-600" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-slate-900 truncate">{flow.name}</h3>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_STYLES[flow.status]}`}>
              {STATUS_LABELS[flow.status]}
            </span>
          </div>
          {flow.description && (
            <p className="text-xs text-slate-500 truncate mb-2">{flow.description}</p>
          )}
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <Play className="w-3 h-3" /> {TRIGGER_LABELS[flow.trigger_type]}
            </span>
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" /> {flow.steps.length} étape{flow.steps.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onEdit}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          {confirming ? (
            <div className="flex items-center gap-1">
              <button onClick={() => { setConfirming(false); onDelete(); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-red-600 bg-red-50 hover:bg-red-100 transition">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setConfirming(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirming(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Page ───────────────────────────── */

export default function FlowsPage() {
  const params    = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const [flows,   setFlows]   = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState<{ open: boolean; flow: Flow | null }>({ open: false, flow: null });
  const [filter,  setFilter]  = useState<FlowStatus | "all">("all");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch(`${FLOWS_URL}?projectId=${projectId}`);
    setFlows(res.flows ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setModal({ open: true, flow: null }); }
  function openEdit(f: Flow) { setModal({ open: true, flow: f }); }
  function closeModal() { setModal({ open: false, flow: null }); }

  function handleSaved(f: Flow) {
    setFlows(prev => {
      const idx = prev.findIndex(p => p.id === f.id);
      return idx >= 0 ? prev.map(p => p.id === f.id ? f : p) : [f, ...prev];
    });
    closeModal();
  }

  async function handleDelete(id: string) {
    await apiFetch(`${FLOWS_URL}?id=${id}`, { method: "DELETE" });
    setFlows(prev => prev.filter(f => f.id !== id));
  }

  const visible = filter === "all" ? flows : flows.filter(f => f.status === filter);

  const counts = {
    all:      flows.length,
    draft:    flows.filter(f => f.status === "draft").length,
    active:   flows.filter(f => f.status === "active").length,
    archived: flows.filter(f => f.status === "archived").length,
  };

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Custom Flows</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Créez des parcours d'onboarding guidés et personnalisés pour vos utilisateurs.
          </p>
        </div>
        <button onClick={openCreate}
          className="btn-dark flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white shrink-0">
          <Plus className="w-4 h-4" /> Nouveau flow
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {(["all", "active", "draft", "archived"] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
              filter === s
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}>
            {s === "all"      && "Tous"}
            {s === "active"   && <><Play    className="w-3 h-3" /> Actifs</>}
            {s === "draft"    && <><FileText className="w-3 h-3" /> Brouillons</>}
            {s === "archived" && <><Archive  className="w-3 h-3" /> Archivés</>}
            <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              filter === s ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
            }`}>
              {counts[s]}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-16 text-center">
          <Workflow className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500 mb-1">
            {filter === "all" ? "Aucun flow créé" : `Aucun flow ${STATUS_LABELS[filter as FlowStatus].toLowerCase()}`}
          </p>
          {filter === "all" && (
            <p className="text-xs text-slate-400 mb-4">
              Créez votre premier parcours d'onboarding personnalisé.
            </p>
          )}
          {filter === "all" && (
            <button onClick={openCreate}
              className="btn-dark inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white">
              <Plus className="w-4 h-4" /> Créer un flow
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(f => (
            <FlowCard
              key={f.id}
              flow={f}
              onEdit={() => openEdit(f)}
              onDelete={() => handleDelete(f.id)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {modal.open && (
        <FlowModal
          projectId={projectId}
          flow={modal.flow}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
