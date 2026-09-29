"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, FileDown, Loader2, X } from "lucide-react";
import { APOSTILA_AMBER, APOSTILA_PURPLE, PDF_EXPORT_MAX, hslTokenToRgb, splitIntoParts, type RGB } from "@/lib/apostilaTheme";
import { KNOWN_SUBJECTS } from "@/lib/subjects";
import { useStudyStore } from "@/lib/store";
import type { Question } from "@/lib/types";
import { cn } from "@/lib/utils";

type ColorChoice = "auto" | "amber" | "purple" | string; // string = slug de grande área

const AREA_COLORS: Record<string, RGB> = Object.fromEntries(KNOWN_SUBJECTS.map((s) => [s.slug, hslTokenToRgb(s.colorToken)]));

function rgbCss(c: RGB) {
  return `rgb(${c[0]} ${c[1]} ${c[2]})`;
}

/**
 * Configura e gera a apostila em PDF (2 colunas, texto justificado, 11 pt) com
 * exatamente as questões selecionadas — na mesma ordem e quantidade da sessão.
 */
export function ApostilaExportModal({
  open,
  onClose,
  questions,
  title,
  subtitle,
}: {
  open: boolean;
  onClose: () => void;
  questions: Question[];
  title?: string;
  subtitle?: string;
}) {
  const studentName = useStudyStore((s) => s.studentName);
  const [color, setColor] = useState<ColorChoice>("auto");
  const [gabarito, setGabarito] = useState(true);
  const [folha, setFolha] = useState(true);
  const [comentarios, setComentarios] = useState(true);
  const [busy, setBusy] = useState<{ part: number; done: number; total: number } | null>(null);
  const [doneParts, setDoneParts] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDoneParts([]);
    setError(null);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const areas = useMemo(() => {
    const counts = new Map<string, number>();
    for (const q of questions) counts.set(q.subjectSlug, (counts.get(q.subjectSlug) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [questions]);

  const withComment = useMemo(() => questions.filter((q) => q.comentario && !q.anulada).length, [questions]);
  const parts = splitIntoParts(questions.length);

  const accent: RGB =
    color === "amber"
      ? APOSTILA_AMBER
      : color === "purple"
        ? APOSTILA_PURPLE
        : color === "auto"
          ? areas.length === 1 && AREA_COLORS[areas[0][0]]
            ? AREA_COLORS[areas[0][0]]
            : APOSTILA_AMBER
          : AREA_COLORS[color] ?? APOSTILA_AMBER;

  async function generate(part: { index: number; start: number; end: number }) {
    setError(null);
    setBusy({ part: part.index, done: 0, total: part.end - part.start });
    try {
      const { exportApostilaPdf } = await import("@/lib/pdfExport");
      await exportApostilaPdf(questions.slice(part.start, part.end), {
        studentName,
        title: title ?? "Apostila de Questões",
        subtitle,
        offset: part.start,
        includeGabarito: gabarito,
        includeFolhaRespostas: folha,
        includeComentarios: comentarios,
        accent,
        areaColors: AREA_COLORS,
        part: { index: part.index, total: parts.length },
        onProgress: (done, total) => setBusy({ part: part.index, done, total }),
      });
      setDoneParts((d) => [...d, part.index]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível gerar o PDF.");
    } finally {
      setBusy(null);
    }
  }

  if (!open) return null;

  const swatches: { id: ColorChoice; label: string; rgb: RGB }[] = [
    { id: "auto", label: "Automática (da grande área)", rgb: accent },
    { id: "amber", label: "Âmbar MedStudy", rgb: APOSTILA_AMBER },
    { id: "purple", label: "Roxo", rgb: APOSTILA_PURPLE },
    ...KNOWN_SUBJECTS.map((s) => ({ id: s.slug, label: s.name, rgb: AREA_COLORS[s.slug] })),
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="apostila-title"
      onClick={() => !busy && onClose()}
    >
      <div
        className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl bg-surface border border-border shadow-lift animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <div>
            <h2 id="apostila-title" className="text-lg font-semibold text-foreground inline-flex items-center gap-2">
              <FileDown size={18} style={{ color: rgbCss(accent) }} /> Exportar apostila em PDF
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              <strong className="text-foreground font-metric">{questions.length}</strong>{" "}
              {questions.length === 1 ? "questão selecionada" : "questões selecionadas"} — a apostila segue exatamente essa
              quantidade e ordem.
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={Boolean(busy)} aria-label="Fechar" className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="grid md:grid-cols-[220px_1fr] gap-6 p-6">
          {/* Miniatura da página */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative w-[200px] aspect-[210/297] rounded-md bg-white shadow-lift border border-black/10 overflow-hidden p-3 flex flex-col">
              <div className="flex items-center justify-between">
                <span className="text-[6px] font-bold tracking-widest" style={{ color: rgbCss(accent) }}>
                  MEDSTUDY HUB
                </span>
                <span className="h-1 w-10 rounded bg-neutral-200" />
              </div>
              <div className="h-px mt-1" style={{ background: rgbCss(accent) }} />
              <div className="flex-1 grid grid-cols-2 gap-[7px] mt-2 relative">
                <span className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2" style={{ background: rgbCss(accent) }} />
                {[0, 1].map((col) => (
                  <div key={col} className="flex flex-col gap-[3px]">
                    {[0, 1].map((q) => (
                      <div key={q} className="flex flex-col gap-[2.5px] mb-1.5">
                        <div className="h-[7px] rounded-sm flex items-center px-0.5" style={{ background: `rgb(${accent.map((v) => Math.round(v + (255 - v) * 0.86)).join(" ")})` }}>
                          <span className="h-[3px] w-6 rounded-sm" style={{ background: rgbCss(accent) }} />
                        </div>
                        {Array.from({ length: col === 0 && q === 0 ? 7 : 5 }).map((_, i, arr) => (
                          <span key={i} className={cn("h-[2px] rounded bg-neutral-300", i === arr.length - 1 ? "w-2/3" : "w-full")} />
                        ))}
                        {["A", "B", "C", "D"].map((l) => (
                          <div key={l} className="flex items-center gap-[3px]">
                            <span className="h-[6px] w-[6px] rounded-full border shrink-0" style={{ borderColor: rgbCss(accent) }} />
                            <span className="h-[2px] flex-1 rounded bg-neutral-300" />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground text-center leading-snug">
              A4 · 2 colunas · texto justificado
              <br />
              Liberation Sans 11 (mesma métrica da Arial)
            </p>
          </div>

          <div className="flex flex-col gap-5 min-w-0">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Cor temática</p>
              <div className="flex flex-wrap gap-2">
                {swatches.map((s) => {
                  const active = color === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setColor(s.id)}
                      title={s.label}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border pl-1 pr-2.5 py-1 text-xs transition-colors",
                        active ? "border-foreground/60 bg-surface-hover text-foreground" : "border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <span className="h-5 w-5 rounded-full inline-flex items-center justify-center" style={{ background: rgbCss(s.rgb) }}>
                        {active && <Check size={12} className="text-white" />}
                      </span>
                      {s.id === "auto" ? "Auto" : s.label.split(" ")[0]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conteúdo</p>
              <Toggle checked={folha} onChange={setFolha} label="Folha de respostas" hint="Grade com círculos A–E para marcar à mão." />
              <Toggle checked={gabarito} onChange={setGabarito} label="Gabarito no final" hint="Desmarque para uma versão de simulado." />
              <Toggle
                checked={comentarios && withComment > 0}
                onChange={setComentarios}
                disabled={withComment === 0 || !gabarito}
                label="Comentários do gabarito"
                hint={withComment > 0 ? `${withComment} ${withComment === 1 ? "questão tem" : "questões têm"} comentário.` : "Nenhuma questão desta seleção tem comentário."}
              />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {parts.length > 1 ? `Arquivos (até ${PDF_EXPORT_MAX} questões cada)` : "Arquivo"}
              </p>
              <div className="flex flex-col gap-2">
                {parts.map((p) => {
                  const running = busy?.part === p.index;
                  const done = doneParts.includes(p.index);
                  return (
                    <div key={p.index} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {parts.length > 1 ? `Parte ${p.index} — ` : ""}questões {p.start + 1} a {p.end}
                        </p>
                        {running ? (
                          <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full transition-[width]"
                              style={{ width: `${Math.round((busy!.done / Math.max(1, busy!.total)) * 100)}%`, background: rgbCss(accent) }}
                            />
                          </div>
                        ) : (
                          <p className="text-[11px] text-muted-foreground font-metric">
                            {done ? "PDF baixado ✓" : `≈ ${Math.max(2, Math.ceil((p.end - p.start) / 3.2) + 2)} páginas`}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() => generate(p)}
                        className={done ? "btn-outline btn-sm" : "btn-primary btn-sm"}
                      >
                        {running ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}
                        {running ? "Gerando…" : done ? "Baixar de novo" : "Gerar PDF"}
                      </button>
                    </div>
                  );
                })}
              </div>
              {error && <p className="text-xs text-danger mt-2">{error}</p>}
              {!studentName.trim() && (
                <p className="text-[11px] text-muted-foreground mt-2">Dica: informe seu nome em Configurações para ele sair na capa e no cabeçalho.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex items-start gap-2.5 cursor-pointer select-none", disabled && "opacity-50 cursor-not-allowed")}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-[hsl(var(--primary))]"
      />
      <span>
        <span className="text-sm text-foreground">{label}</span>
        {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}
