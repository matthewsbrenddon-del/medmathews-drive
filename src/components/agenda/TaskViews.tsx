"use client";

import { useState } from "react";
import { CalendarClock, CheckCircle2, Circle, GripVertical, Plus, Trash2 } from "lucide-react";
import { addDays, parseYmd, startOfDay, ymd, type AgendaTask, type TaskStatus } from "@/lib/agenda";
import { cn } from "@/lib/utils";

const PRIORIDADE = { 1: { label: "Baixa", cls: "text-muted-foreground" }, 2: { label: "Média", cls: "text-warning" }, 3: { label: "Alta", cls: "text-danger" } } as const;

function dueLabel(t: AgendaTask): { text: string; late: boolean } | null {
  if (!t.due) return null;
  const today = startOfDay(new Date());
  const d = parseYmd(t.due);
  const diff = Math.round((d.getTime() - today.getTime()) / 864e5);
  const time = t.dueTime ? ` ${t.dueTime}` : "";
  if (diff === 0) return { text: `Hoje${time}`, late: false };
  if (diff === 1) return { text: `Amanhã${time}`, late: false };
  if (diff === -1) return { text: `Ontem${time}`, late: t.status !== "done" };
  return { text: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) + time, late: diff < 0 && t.status !== "done" };
}

function Badges({ t }: { t: AgendaTask }) {
  const due = dueLabel(t);
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-[10px]">
      {due && (
        <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5", due.late ? "bg-danger/10 text-danger" : "bg-muted text-muted-foreground")}>
          <CalendarClock size={10} /> {due.text}
        </span>
      )}
      {t.prioridade && <span className={cn("font-medium", PRIORIDADE[t.prioridade].cls)}>● {PRIORIDADE[t.prioridade].label}</span>}
      {t.tag && <span className="rounded-full bg-accent/10 text-accent px-1.5 py-0.5">#{t.tag}</span>}
      {t.source === "google" && <span className="rounded-full bg-[#4285f4]/10 text-[#4285f4] px-1.5 py-0.5">Google Tasks{t.listName ? ` · ${t.listName}` : ""}</span>}
    </span>
  );
}

export function TodoView({
  tasks,
  onToggle,
  onDelete,
  onQuickAdd,
}: {
  tasks: AgendaTask[];
  onToggle: (t: AgendaTask) => void;
  onDelete: (t: AgendaTask) => void;
  onQuickAdd: (title: string, due?: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [draftDue, setDraftDue] = useState("hoje");
  const today = ymd(new Date());
  const tomorrow = ymd(addDays(new Date(), 1));
  const weekEnd = ymd(addDays(new Date(), 7));

  const open = tasks.filter((t) => t.status !== "done");
  const groups: { id: string; label: string; items: AgendaTask[] }[] = [
    { id: "atrasadas", label: "Atrasadas", items: open.filter((t) => t.due && t.due < today) },
    { id: "hoje", label: "Hoje", items: open.filter((t) => t.due === today) },
    { id: "amanha", label: "Amanhã", items: open.filter((t) => t.due === tomorrow) },
    { id: "semana", label: "Próximos 7 dias", items: open.filter((t) => t.due && t.due > tomorrow && t.due <= weekEnd) },
    { id: "depois", label: "Mais adiante", items: open.filter((t) => t.due && t.due > weekEnd) },
    { id: "semdata", label: "Sem data", items: open.filter((t) => !t.due) },
    {
      id: "feitas",
      label: "Concluídas",
      items: tasks
        .filter((t) => t.status === "done")
        .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
        .slice(0, 15),
    },
  ];
  for (const g of groups) g.items.sort((a, b) => (a.due ?? "9").localeCompare(b.due ?? "9") || (b.prioridade ?? 0) - (a.prioridade ?? 0));

  function submit() {
    if (!draft.trim()) return;
    const due = draftDue === "hoje" ? today : draftDue === "amanha" ? tomorrow : draftDue === "sem" ? undefined : draftDue;
    onQuickAdd(draft.trim(), due);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div className="card p-3 flex flex-wrap items-center gap-2">
        <Plus size={16} className="text-primary ml-1" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Nova tarefa… (Enter para adicionar)"
          className="flex-1 min-w-[180px] bg-transparent text-sm text-foreground outline-none"
        />
        <select value={draftDue} onChange={(e) => setDraftDue(e.target.value)} className="input w-auto py-1 text-xs" aria-label="Prazo">
          <option value="hoje">Hoje</option>
          <option value="amanha">Amanhã</option>
          <option value="sem">Sem data</option>
        </select>
        <button type="button" className="btn-primary btn-sm" onClick={submit} disabled={!draft.trim()}>
          Adicionar
        </button>
      </div>

      {groups
        .filter((g) => g.items.length > 0)
        .map((g) => (
          <section key={g.id}>
            <h3 className={cn("text-xs font-semibold uppercase tracking-wide mb-2 px-1", g.id === "atrasadas" ? "text-danger" : "text-muted-foreground")}>
              {g.label} <span className="font-metric">· {g.items.length}</span>
            </h3>
            <div className="card divide-y divide-border/60">
              {g.items.map((t) => (
                <div key={t.id} className="group flex items-start gap-3 px-4 py-3">
                  <button type="button" onClick={() => onToggle(t)} className="mt-0.5 text-muted-foreground hover:text-success" aria-label={t.status === "done" ? "Reabrir tarefa" : "Concluir tarefa"}>
                    {t.status === "done" ? <CheckCircle2 size={18} className="text-success" /> : <Circle size={18} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm", t.status === "done" ? "line-through text-muted-foreground" : "text-foreground")}>{t.title}</p>
                    {t.notes && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{t.notes}</p>}
                    <div className="mt-1">
                      <Badges t={t} />
                    </div>
                  </div>
                  {t.source === "local" && (
                    <button type="button" onClick={() => onDelete(t)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-danger" aria-label="Excluir tarefa">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      {tasks.length === 0 && <p className="text-sm text-muted-foreground px-1">Nenhuma tarefa ainda — adicione a primeira acima.</p>}
    </div>
  );
}

const COLUMNS: { id: TaskStatus; label: string; tone: string }[] = [
  { id: "todo", label: "A fazer", tone: "bg-muted-foreground" },
  { id: "doing", label: "Fazendo", tone: "bg-primary" },
  { id: "done", label: "Concluído", tone: "bg-success" },
];

export function KanbanView({
  tasks,
  onMove,
  onDelete,
  onAdd,
}: {
  tasks: AgendaTask[];
  onMove: (t: AgendaTask, status: TaskStatus) => void;
  onDelete: (t: AgendaTask) => void;
  onAdd: (title: string, status: TaskStatus) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);
  const [adding, setAdding] = useState<{ col: TaskStatus; text: string } | null>(null);

  return (
    <div className="grid md:grid-cols-3 gap-4 items-start">
      {COLUMNS.map((col) => {
        const items = tasks
          .filter((t) => t.status === col.id)
          .sort((a, b) => (b.prioridade ?? 0) - (a.prioridade ?? 0) || (a.due ?? "9").localeCompare(b.due ?? "9"))
          .slice(0, col.id === "done" ? 30 : 200);
        return (
          <section
            key={col.id}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(col.id);
            }}
            onDragLeave={() => setOver((o) => (o === col.id ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              const t = tasks.find((x) => x.id === dragId);
              if (t && t.status !== col.id) onMove(t, col.id);
              setDragId(null);
              setOver(null);
            }}
            className={cn("rounded-2xl border bg-muted/30 p-3 flex flex-col gap-2 min-h-[300px] transition-colors", over === col.id ? "border-primary bg-primary/5" : "border-border")}
          >
            <div className="flex items-center justify-between px-1 pb-1">
              <h3 className="text-sm font-semibold text-foreground inline-flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", col.tone)} /> {col.label}
                <span className="font-metric text-xs text-muted-foreground">{tasks.filter((t) => t.status === col.id).length}</span>
              </h3>
              <button type="button" onClick={() => setAdding({ col: col.id, text: "" })} className="text-muted-foreground hover:text-primary" aria-label={`Adicionar em ${col.label}`}>
                <Plus size={16} />
              </button>
            </div>
            {adding?.col === col.id && (
              <input
                autoFocus
                value={adding.text}
                onChange={(e) => setAdding({ col: col.id, text: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && adding.text.trim()) {
                    onAdd(adding.text.trim(), col.id);
                    setAdding(null);
                  }
                  if (e.key === "Escape") setAdding(null);
                }}
                onBlur={() => setAdding(null)}
                placeholder="Título + Enter"
                className="input py-2 text-sm"
              />
            )}
            {items.map((t) => (
              <article
                key={t.id}
                draggable
                onDragStart={() => setDragId(t.id)}
                onDragEnd={() => setDragId(null)}
                className={cn("group card p-3 flex gap-2 cursor-grab active:cursor-grabbing", dragId === t.id && "opacity-50")}
              >
                <GripVertical size={14} className="text-muted-foreground/50 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium", t.status === "done" ? "line-through text-muted-foreground" : "text-foreground")}>{t.title}</p>
                  {t.notes && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{t.notes}</p>}
                  <div className="mt-1.5">
                    <Badges t={t} />
                  </div>
                  <div className="mt-2 flex gap-1 md:hidden">
                    {COLUMNS.filter((c) => c.id !== t.status).map((c) => (
                      <button key={c.id} type="button" onClick={() => onMove(t, c.id)} className="text-[10px] rounded-full border border-border px-2 py-0.5 text-muted-foreground">
                        → {c.label}
                      </button>
                    ))}
                  </div>
                </div>
                {t.source === "local" && (
                  <button type="button" onClick={() => onDelete(t)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-danger self-start" aria-label="Excluir tarefa">
                    <Trash2 size={14} />
                  </button>
                )}
              </article>
            ))}
            {items.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Arraste tarefas para cá</p>}
          </section>
        );
      })}
    </div>
  );
}
