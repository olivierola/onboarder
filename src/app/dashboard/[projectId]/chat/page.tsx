"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Send, Bot, User, Plus, Loader2, RefreshCw,
  MessageCircle, Trash2, ChevronDown, Zap, Clock,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  confidence?: number | null;
  ts: string;
  streaming?: boolean;
}

interface Session {
  id: string;
  label: string;
  startedAt: string;
  turnCount: number;
  lastMessage: string | null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}j`;
}

function newSessionId(projectId: string) {
  return `chat-${projectId}-${Date.now()}`;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const params    = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const CHAT_URL     = `${SUPABASE_URL}/functions/v1/chat`;

  // ── State ──────────────────────────────────────────────────────────────
  const [sessions,       setSessions]       = useState<Session[]>([]);
  const [activeSession,  setActiveSession]  = useState<Session | null>(null);
  const [messages,       setMessages]       = useState<ChatMessage[]>([]);
  const [input,          setInput]          = useState("");
  const [sending,        setSending]        = useState(false);
  const [route,          setRoute]          = useState("/");
  const [showRouteMenu,  setShowRouteMenu]  = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);
  const abortRef       = useRef<AbortController | null>(null);

  // ── Scroll to bottom ───────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Load sessions from localStorage ────────────────────────────────────
  useEffect(() => {
    const key = `chat_sessions_${projectId}`;
    try {
      const stored = JSON.parse(localStorage.getItem(key) ?? "[]") as Session[];
      setSessions(stored);
    } catch { /* ignore */ }
  }, [projectId]);

  function saveSessions(updated: Session[]) {
    const key = `chat_sessions_${projectId}`;
    localStorage.setItem(key, JSON.stringify(updated));
    setSessions(updated);
  }

  // ── Create new session ─────────────────────────────────────────────────
  function createSession() {
    const id = newSessionId(projectId);
    const session: Session = {
      id,
      label: `Session ${sessions.length + 1}`,
      startedAt: new Date().toISOString(),
      turnCount: 0,
      lastMessage: null,
    };
    const updated = [session, ...sessions];
    saveSessions(updated);
    setActiveSession(session);
    setMessages([]);
  }

  // ── Select session ─────────────────────────────────────────────────────
  function selectSession(session: Session) {
    setActiveSession(session);
    // Load messages from localStorage
    const key = `chat_messages_${session.id}`;
    try {
      const stored = JSON.parse(localStorage.getItem(key) ?? "[]") as ChatMessage[];
      setMessages(stored);
    } catch { setMessages([]); }
  }

  function saveMessages(sessionId: string, msgs: ChatMessage[]) {
    const key = `chat_messages_${sessionId}`;
    localStorage.setItem(key, JSON.stringify(msgs));
  }

  // ── Delete session ─────────────────────────────────────────────────────
  function deleteSession(sessionId: string) {
    localStorage.removeItem(`chat_messages_${sessionId}`);
    const updated = sessions.filter(s => s.id !== sessionId);
    saveSessions(updated);
    if (activeSession?.id === sessionId) {
      setActiveSession(null);
      setMessages([]);
    }
  }

  // ── Send message ───────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    if (!input.trim() || sending || !activeSession) return;

    const userContent = input.trim();
    setInput("");
    setSending(true);

    // Abort any previous stream
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: userContent,
      ts: new Date().toISOString(),
    };

    const assistantMsg: ChatMessage = {
      id: `a-${Date.now()}`,
      role: "assistant",
      content: "",
      ts: new Date().toISOString(),
      streaming: true,
    };

    const nextMessages = [...messages, userMsg, assistantMsg];
    setMessages(nextMessages);

    // Build history (exclude the streaming placeholder)
    const history = messages.map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch(CHAT_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "apikey": ANON_KEY,
          "Authorization": `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({
          projectId,
          sessionId: activeSession.id,
          question: userContent,
          conversationHistory: history,
          uiContext: {
            currentRoute: route,
            pageTitle: `Test depuis le dashboard`,
            visibleElements: [],
          },
          userProfile: { role: "admin", plan: "test" },
        }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let replyText = "";
      let confidence: number | null = null;
      let currentEvent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const raw = line.slice(6);
            if (raw === "{}") continue;

            try {
              const parsed = JSON.parse(raw);

              // Token-by-token streaming (event: token)
              if (currentEvent === "token" && parsed.text) {
                replyText += parsed.text;
                setMessages(prev => prev.map(m =>
                  m.id === assistantMsg.id
                    ? { ...m, content: replyText, streaming: true }
                    : m
                ));
              }

              // Full parsed response (event: actions)
              if (currentEvent === "actions") {
                if (parsed.reply) replyText = parsed.reply;
                if (typeof parsed.confidence === "number") confidence = parsed.confidence;
              }

              // Error event
              if (currentEvent === "error" && parsed.error) {
                replyText = `Erreur : ${parsed.error}`;
              }
            } catch { /* partial chunk */ }
          }
        }
      }

      // Finalize assistant message
      const finalMessages = nextMessages.map(m =>
        m.id === assistantMsg.id
          ? { ...m, content: replyText || "…", streaming: false, confidence }
          : m
      );
      setMessages(finalMessages);
      saveMessages(activeSession.id, finalMessages);

      // Update session metadata
      const updatedSession: Session = {
        ...activeSession,
        turnCount: activeSession.turnCount + 1,
        lastMessage: userContent.slice(0, 60),
      };
      setActiveSession(updatedSession);
      const updatedSessions = sessions.map(s => s.id === activeSession.id ? updatedSession : s);
      saveSessions(updatedSessions);

    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") return;
      const finalMessages = nextMessages.map(m =>
        m.id === assistantMsg.id
          ? { ...m, content: "Erreur de connexion à l'agent.", streaming: false }
          : m
      );
      setMessages(finalMessages);
      saveMessages(activeSession.id, finalMessages);
    } finally {
      setSending(false);
    }
  }, [input, sending, activeSession, messages, projectId, route, CHAT_URL, ANON_KEY, sessions]);

  // ── Keyboard send ──────────────────────────────────────────────────────
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function confColor(c: number | null | undefined) {
    if (c == null) return "text-slate-400";
    if (c >= 0.7) return "text-emerald-500";
    if (c >= 0.5) return "text-yellow-500";
    return "text-red-500";
  }

  const QUICK_ROUTES = ["/", "/dashboard", "/settings", "/billing", "/onboarding"];

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex overflow-hidden">

      {/* ── LEFT: Sessions panel ───────────────────────────────────────── */}
      <div className="w-64 flex flex-col border-r border-slate-200 bg-white shrink-0 h-full">
        <div className="px-4 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-800">Sessions de test</h2>
          </div>
          <button
            onClick={createSession}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Nouvelle session
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <MessageCircle className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-xs text-slate-400">Aucune session</p>
              <p className="text-[10px] text-slate-300 mt-1">Créez une nouvelle session pour tester l&apos;agent.</p>
            </div>
          ) : (
            sessions.map(s => (
              <div
                key={s.id}
                onClick={() => selectSession(s)}
                className={cn(
                  "group flex items-start gap-2.5 px-4 py-3 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors border-l-[3px]",
                  activeSession?.id === s.id
                    ? "bg-violet-50 border-l-violet-500"
                    : "border-l-transparent"
                )}
              >
                <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-violet-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 truncate">{s.label}</span>
                    <button
                      onClick={e => { e.stopPropagation(); deleteSession(s.id); }}
                      className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all ml-1 shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                    {s.lastMessage ?? "Pas encore de message"}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />{timeAgo(s.startedAt)}
                    </span>
                    {s.turnCount > 0 && (
                      <span className="text-[10px] text-slate-400">{s.turnCount} échange{s.turnCount > 1 ? "s" : ""}</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── MAIN: Chat area ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {!activeSession ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 text-center px-8">
            <div className="w-16 h-16 bg-white rounded-2xl border border-slate-200 flex items-center justify-center mb-4 shadow-sm">
              <Bot className="w-7 h-7 text-slate-300" />
            </div>
            <h3 className="text-sm font-semibold text-slate-600 mb-2">Testez votre agent en direct</h3>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed mb-5">
              Créez une session de test pour dialoguer avec l&apos;agent et valider ses réponses avant le déploiement.
            </p>
            <button
              onClick={createSession}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Démarrer une session
            </button>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-5 py-3.5 bg-white border-b border-slate-200 shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center ring-1 ring-violet-200">
                  <Bot className="w-4 h-4 text-violet-600" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-800">{activeSession.label}</div>
                  <div className="text-[10px] text-slate-400 font-mono truncate max-w-[200px]">{activeSession.id}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Route selector */}
                <div className="relative">
                  <button
                    onClick={() => setShowRouteMenu(v => !v)}
                    className="flex items-center gap-1.5 text-xs font-mono text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <span className="text-slate-400 text-[10px]">route:</span>
                    {route}
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  </button>
                  {showRouteMenu && (
                    <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1 min-w-[160px]">
                      {QUICK_ROUTES.map(r => (
                        <button
                          key={r}
                          onClick={() => { setRoute(r); setShowRouteMenu(false); }}
                          className={cn(
                            "w-full text-left px-3 py-2 text-xs font-mono hover:bg-slate-50 transition-colors",
                            route === r ? "text-violet-700 font-semibold" : "text-slate-600"
                          )}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    setMessages([]);
                    saveMessages(activeSession.id, []);
                  }}
                  title="Effacer la conversation"
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-[#f8f8fb]">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Zap className="w-8 h-8 text-violet-300 mb-2" />
                  <p className="text-sm font-medium text-slate-500">Session démarrée</p>
                  <p className="text-xs text-slate-400 mt-1">Envoyez votre premier message à l&apos;agent.</p>
                </div>
              )}

              {messages.map((msg) => (
                <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "")}>
                  {/* Avatar */}
                  <div className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center shrink-0 ring-1 mt-0.5",
                    msg.role === "user"
                      ? "bg-indigo-100 text-indigo-600 ring-indigo-200"
                      : "bg-slate-800 text-white ring-slate-700"
                  )}>
                    {msg.role === "user"
                      ? <User className="w-3.5 h-3.5" />
                      : <Bot className="w-3.5 h-3.5" />
                    }
                  </div>

                  {/* Bubble */}
                  <div className={cn("max-w-[72%] space-y-1", msg.role === "user" && "flex flex-col items-end")}>
                    <div className={cn(
                      "px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
                      msg.role === "user"
                        ? "bg-indigo-500 text-white rounded-tr-sm"
                        : "bg-white border border-slate-200 text-slate-700 rounded-tl-sm shadow-sm"
                    )}>
                      {msg.content}
                      {msg.streaming && (
                        <span className="inline-block w-1.5 h-4 bg-slate-400 ml-1 animate-pulse rounded-sm align-middle" />
                      )}
                    </div>

                    <div className="flex items-center gap-2 px-1">
                      <span className="text-[10px] text-slate-400">
                        {new Date(msg.ts).toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {msg.role === "assistant" && msg.confidence != null && (
                        <span className={cn("text-[10px] font-mono font-semibold", confColor(msg.confidence))}>
                          {Math.round(msg.confidence * 100)}% conf.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input bar */}
            <div className="px-4 py-3 bg-white border-t border-slate-200 shrink-0">
              <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 focus-within:border-violet-300 focus-within:bg-white transition-all">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Écrivez votre message… (Entrée pour envoyer)"
                  rows={1}
                  disabled={sending}
                  className="flex-1 resize-none text-sm text-slate-700 placeholder-slate-400 bg-transparent outline-none leading-relaxed max-h-32 disabled:opacity-50"
                  style={{ minHeight: "24px" }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || sending}
                  className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {sending
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Send className="w-3.5 h-3.5" />
                  }
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5 px-1">
                Shift+Entrée pour un saut de ligne · route simulée : <code className="font-mono">{route}</code>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
