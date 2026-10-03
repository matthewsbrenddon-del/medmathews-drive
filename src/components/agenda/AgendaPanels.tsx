"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarPlus,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Link2,
  ListTodo,
  Loader2,
  LogOut,
  MapPin,
  RefreshCcw,
  Trash2,
  X,
} from "lucide-react";
import {
  CRONOGRAMA_COLOR,
  FOCO_COLOR,
  LOCAL_COLOR,
  eventBounds,
  fmtTime,
  useAgendaStore,
  type AgendaEvent,
  type TaskStatus,
} from "@/lib/agenda";
import { ENV_CLIENT_ID, disconnectGoogle, getStoredToken, listCalendars, preloadGoogle, requestGoogleToken } from "@/lib/googleCalendar";
import type { SyncState } from "@/lib/useAgendaData";
import { cn } from "@/lib/utils";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-surface border border-border shadow-lift p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export interface NewItemDraft {
  kind: "evento" | "tarefa";
  date: string;
  time?: string;
}

export interface NewEventInput {
  title: string;
  description?: string;
  allDay: boolean;
  /** ISO local datetime ou YYYY-MM-DD */
  start: string;
  end: string;
  destino: string; // "local" | id do calendário Google
}

export interface NewTaskInput {
  title: string;
  notes?: string;
  due?: string;
  dueTime?: string;
  prioridade?: 1 | 2 | 3;
  tag?: string;
  status: TaskStatus;
  destino: "local" | "google";
}

export function NewItemModal({
  draft,
  onClose,
  onCreateEvent,
  onCreateTask,
  googleReady,
}: {
  draft: NewItemDraft;
  onClose: () => void;
  onCreateEvent: (e: NewEventInput) => Promise<void>;
  onCreateTask: (t: NewTaskInput) => Promise<void>;
  googleReady: boolean;
}) {
  const calendars = useAgendaStore((s) => s.googleCalendars);
  const writable = googleReady ? calendars.filter((c) => c.writable) : [];
  const [kind, setKind] = useState(draft.kind);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(draft.date);
  const [allDay, setAllDay] = useState(!draft.time);
  const [start, setStart] = useState(draft.time ?? "09:00");
  const [end, setEnd] = useState(() => {
    const [h, m] = (draft.time ?? "09:00").split(":").map(Number);
    return `${String(Math.min(23, h + 1)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  });
  const [desc, setDesc] = useState("");
  const [destino, setDestino] = useState("local");
  const [prioridade, setPrioridade] = useState<0 | 1 | 2 | 3>(0);
  const [tag, setTag] = useState("");
  const [semData, setSemData] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (kind === "evento") {
        if (allDay) {
          const d = new Date(`${date}T12:00:00`);
          d.setDate(d.getDate() + 1);
          const endDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          await onCreateEvent({ title: title.trim(), description: desc || undefined, allDay: true, start: date, end: endDate, destino });
        } else {
          const s = new Date(`${date}T${start}:00`);
          let e = new Date(`${date}T${end}:00`);
          if (e <= s) e = new Date(s.getTime() + 60 * 60_000);
          await onCreateEvent({ title: title.trim(), description: desc || undefined, allDay: false, start: s.toISOString(), end: e.toISOString(), destino });
        }
      } else {
        await onCreateTask({
          title: title.trim(),
          notes: desc || undefined,
          due: semData ? undefined : date,
          dueTime: !semData && !allDay && destino === "local" ? start : undefined,
          prioridade: prioridade || undefined,
          tag: tag.trim() || undefined,
          status: "todo",
          destino: destino === "google" ? "google" : "local",
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={kind === "evento" ? "Novo evento" : "Nova tarefa"} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="inline-flex self-start rounded-xl border border-border p-0.5 bg-muted/60 text-sm">
          {(["evento", "tarefa"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKind(k);
                setDestino("local");
              }}
              className={cn("px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5", kind === k ? "bg-surface shadow-card text-foreground" : "text-muted-foreground")}
            >
              {k === "evento" ? <CalendarPlus size={14} /> : <ListTodo size={14} />} {k === "evento" ? "Evento" : "Tarefa"}
            </button>
          ))}
        </div>
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} placeholder={kind === "evento" ? "Ex.: Plantão PS, Aula de Cardio" : "Ex.: Revisar arritmias, 30 questões de GO"} className="input text-base" />

        <div className="flex flex-wrap items-center gap-3">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={kind === "tarefa" && semData} className="input w-auto py-1.5 text-sm" />
          {!(kind === "tarefa" && (semData || destino === "google")) && (
            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="accent-[hsl(var(--primary))]" />
              {kind === "evento" ? "Dia inteiro" : "Sem horário"}
            </label>
          )}
          {kind === "tarefa" && (
            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={semData} onChange={(e) => setSemData(e.target.checked)} className="accent-[hsl(var(--primary))]" />
              Sem data
            </label>
          )}
        </div>
        {!allDay && !(kind === "tarefa" && (semData || destino === "google")) && (
          <div className="flex items-center gap-2 text-sm">
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="input w-auto py-1.5" />
            {kind === "evento" && (
              <>
                <span className="text-muted-foreground">até</span>
                <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="input w-auto py-1.5" />
              </>
            )}
          </div>
        )}

        {kind === "tarefa" && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-lg border border-border p-0.5 text-xs">
              {([0, 1, 2, 3] as const).map((p) => (
                <button key={p} type="button" onClick={() => setPrioridade(p)} className={cn("px-2.5 py-1 rounded-md", prioridade === p ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                  {p === 0 ? "Sem prioridade" : p === 1 ? "Baixa" : p === 2 ? "Média" : "Alta"}
                </button>
              ))}
            </div>
            {destino === "local" && <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="#etiqueta (ex.: cardio)" className="input w-40 py-1.5 text-sm" />}
          </div>
        )}

        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="Detalhes (opcional)" className="input text-sm" />

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">Salvar em</span>
          <select value={destino} onChange={(e) => setDestino(e.target.value)} className="input py-2">
            <option value="local">MedStudy (só neste navegador)</option>
            {kind === "evento" && writable.map((c) => <option key={c.id} value={c.id}>Google Agenda — {c.summary}</option>)}
            {kind === "tarefa" && googleReady && <option value="google">Google Tasks</option>}
          </select>
          {!googleReady && <span className="text-[11px] text-muted-foreground">Conecte sua conta Google (painel ao lado) para criar direto no Google Agenda/Tasks.</span>}
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" disabled={!title.trim() || saving} onClick={save}>
            {saving && <Loader2 size={14} className="animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function EventDetailModal({
  event,
  onClose,
  onDelete,
}: {
  event: AgendaEvent;
  onClose: () => void;
  onDelete?: () => Promise<void> | void;
}) {
  const { start, end } = eventBounds(event);
  const [busy, setBusy] = useState(false);
  const sameDay = start.toDateString() === new Date(end.getTime() - 1).toDateString();
  const when = event.allDay
    ? sameDay
      ? start.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })
      : `${start.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${new Date(end.getTime() - 1).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`
    : `${start.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })} · ${fmtTime(start)}–${fmtTime(end)}`;
  return (
    <Modal title={event.title} onClose={onClose}>
      <div className="flex flex-col gap-3 text-sm">
        <p className="text-foreground first-letter:uppercase">{when}</p>
        <p className="inline-flex items-center gap-2 text-muted-foreground">
          <span className="h-3 w-3 rounded-full" style={{ background: event.color }} /> {event.calendarName}
        </p>
        {event.location && (
          <p className="inline-flex items-start gap-2 text-muted-foreground">
            <MapPin size={14} className="mt-0.5 shrink-0" /> {event.location}
          </p>
        )}
        {event.description && <p className="whitespace-pre-line text-foreground/90 rounded-xl bg-muted/50 p-3 max-h-60 overflow-y-auto">{event.description}</p>}
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          {event.href && (
            <Link href={event.href} className="btn-outline btn-sm">
              Abrir na plataforma
            </Link>
          )}
          {event.link && (
            <a href={event.link} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">
              <ExternalLink size={13} /> Abrir no Google Agenda
            </a>
          )}
          {onDelete && (
            <button
              type="button"
              className="btn-ghost btn-sm text-danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onDelete();
                  onClose();
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Trash2 size={13} /> Excluir
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-border/60 last:border-0 py-3">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && <div className="mt-2.5 flex flex-col gap-2">{children}</div>}
    </section>
  );
}

function Toggle({ checked, onChange, color, label, hint }: { checked: boolean; onChange: () => void; color: string; label: string; hint?: string }) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer text-sm">
      <input type="checkbox" checked={checked} onChange={onChange} className="mt-0.5 h-4 w-4 shrink-0" style={{ accentColor: color }} />
      <span className="min-w-0">
        <span className="block text-foreground truncate">{label}</span>
        {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

export function SourcesPanel({ googleState, icsErrors, onSynced }: { googleState: SyncState; icsErrors: Record<string, string>; onSynced: () => void }) {
  const s = useAgendaStore();
  const [clientDraft, setClientDraft] = useState(s.googleClientId);
  const [connecting, setConnecting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [icsUrl, setIcsUrl] = useState("");
  const [icsName, setIcsName] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const clientId = ENV_CLIENT_ID || s.googleClientId;

  useEffect(() => {
    if (clientId) preloadGoogle();
  }, [clientId]);

  async function connect(prompt: "" | "consent", id = clientId) {
    setConnecting(true);
    setAuthError(null);
    try {
      await requestGoogleToken(id, prompt);
      s.setGoogleConnected(true);
      s.setGoogleCalendars(await listCalendars());
      onSynced();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Não foi possível conectar.");
    } finally {
      setConnecting(false);
    }
  }

  return (
    <aside className="card px-4 py-1 self-start">
      <Section title="Conta Google">
        {s.googleConnected ? (
          <>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className={cn("inline-flex items-center gap-1.5", googleState === "ok" ? "text-success" : googleState === "expired" ? "text-warning" : googleState === "error" ? "text-danger" : "text-muted-foreground")}>
                <span className={cn("h-2 w-2 rounded-full", googleState === "ok" ? "bg-success animate-pulse" : googleState === "expired" ? "bg-warning" : "bg-danger")} />
                {googleState === "ok" ? "Sincronizado em tempo real" : googleState === "expired" ? "Sessão expirou" : googleState === "error" ? "Erro ao sincronizar" : "Conectando…"}
              </span>
              <button
                type="button"
                onClick={() => {
                  disconnectGoogle();
                  s.setGoogleConnected(false);
                  s.setGoogleCalendars([]);
                  onSynced();
                }}
                className="text-muted-foreground hover:text-danger"
                title="Desconectar"
              >
                <LogOut size={14} />
              </button>
            </div>
            {(googleState === "expired" || !getStoredToken()) && (
              <button type="button" className="btn-primary btn-sm" onClick={() => connect("")} disabled={connecting}>
                {connecting ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />} Reconectar
              </button>
            )}
            {s.googleCalendars.map((c) => (
              <Toggle key={c.id} checked={c.enabled} onChange={() => s.toggleGoogleCalendar(c.id)} color={c.color} label={c.summary} hint={c.primary ? "principal" : undefined} />
            ))}
            <Toggle checked={s.layers.googleTasks} onChange={() => s.toggleLayer("googleTasks")} color="#4285f4" label="Google Tasks" hint="tarefas no To-do e no Kanban" />
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">Veja e crie eventos e tarefas do seu Google Agenda, atualizados a cada minuto.</p>
            {!ENV_CLIENT_ID && (
              <div className="flex flex-col gap-1.5">
                <input value={clientDraft} onChange={(e) => setClientDraft(e.target.value)} onBlur={() => s.setGoogleClientId(clientDraft)} placeholder="ID do cliente OAuth (…apps.googleusercontent.com)" className="input py-1.5 text-xs" />
                <button type="button" onClick={() => setShowHelp((v) => !v)} className="self-start text-[11px] text-primary hover:underline">
                  Como obter o ID do cliente?
                </button>
                {showHelp && (
                  <ol className="list-decimal pl-4 text-[11px] text-muted-foreground space-y-1">
                    <li>
                      Em <span className="text-foreground">console.cloud.google.com</span>, crie um projeto e ative as APIs <em>Google Calendar</em> e <em>Google Tasks</em>.
                    </li>
                    <li>Configure a tela de consentimento OAuth (tipo Externo) e adicione seu e-mail como usuário de teste.</li>
                    <li>
                      Em Credenciais → Criar → ID do cliente OAuth → <em>Aplicativo da Web</em>, adicione a origem <span className="text-foreground font-metric">{typeof window !== "undefined" ? window.location.origin : ""}</span>.
                    </li>
                    <li>Cole aqui o ID gerado (ou defina NEXT_PUBLIC_GOOGLE_CLIENT_ID no deploy).</li>
                  </ol>
                )}
              </div>
            )}
            <button
              type="button"
              className="btn-primary btn-sm"
              disabled={connecting || !(ENV_CLIENT_ID || clientDraft.trim())}
              onClick={() => {
                if (!ENV_CLIENT_ID) s.setGoogleClientId(clientDraft);
                connect("consent", ENV_CLIENT_ID || clientDraft.trim());
              }}
            >
              {connecting ? <Loader2 size={13} className="animate-spin" /> : <span className="font-bold">G</span>} Conectar Google Agenda
            </button>
          </>
        )}
        {authError && <p className="text-[11px] text-danger">{authError}</p>}
      </Section>

      <Section title="Link iCal (somente leitura)" defaultOpen={s.icsFeeds.length > 0 || !s.googleConnected}>
        <p className="text-[11px] text-muted-foreground">
          Sem configurar nada: no Google Agenda, abra <em>Configurações da agenda → Integrar agenda → Endereço secreto no formato iCal</em> e cole aqui.
        </p>
        {s.icsFeeds.map((f) => (
          <div key={f.id} className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <Toggle checked={f.enabled} onChange={() => s.updateFeed(f.id, { enabled: !f.enabled })} color={f.color} label={f.name} />
              {icsErrors[f.id] && (
                <p className="text-[11px] text-danger inline-flex items-start gap-1 ml-6">
                  <AlertTriangle size={11} className="mt-0.5 shrink-0" /> {icsErrors[f.id]}
                </p>
              )}
            </div>
            <button type="button" onClick={() => s.removeFeed(f.id)} className="text-muted-foreground hover:text-danger" aria-label={`Remover ${f.name}`}>
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        <input value={icsUrl} onChange={(e) => setIcsUrl(e.target.value)} placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" className="input py-1.5 text-xs" />
        <div className="flex gap-2">
          <input value={icsName} onChange={(e) => setIcsName(e.target.value)} placeholder="Nome (ex.: Plantões)" className="input py-1.5 text-xs flex-1" />
          <button
            type="button"
            className="btn-outline btn-sm"
            disabled={!/^(https|webcal):\/\/calendar\.google\.com\/calendar\/ical\//.test(icsUrl.trim())}
            onClick={() => {
              s.addFeed(icsUrl, icsName);
              setIcsUrl("");
              setIcsName("");
              onSynced();
            }}
          >
            <Link2 size={13} /> Adicionar
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground">O link secreto dá acesso de leitura à agenda — fica salvo só neste navegador.</p>
      </Section>

      <Section title="Camadas da plataforma">
        <Toggle checked={s.layers.local} onChange={() => s.toggleLayer("local")} color={LOCAL_COLOR} label="Meus eventos (MedStudy)" />
        <Toggle checked={s.layers.tarefas} onChange={() => s.toggleLayer("tarefas")} color={LOCAL_COLOR} label="Tarefas no calendário" hint="aparecem no dia do prazo" />
        <Toggle checked={s.layers.cronograma} onChange={() => s.toggleLayer("cronograma")} color={CRONOGRAMA_COLOR} label="Cronograma de estudos" />
        <Toggle checked={s.layers.foco} onChange={() => s.toggleLayer("foco")} color={FOCO_COLOR} label="Sessões de estudo (Pomodoro)" />
      </Section>
    </aside>
  );
}
