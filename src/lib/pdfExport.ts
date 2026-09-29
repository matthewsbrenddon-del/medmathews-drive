import { jsPDF } from "jspdf";
import type { Question } from "./types";
import { reflowText } from "./reflowText";

// ============================================================================
// Apostila de questões em PDF.
//
// - A4, duas colunas separadas por um fio vertical na cor temática.
// - Texto justificado em Liberation Sans 11 — fonte livre (OFL) com as mesmas
//   medidas da Arial: a Arial é proprietária e não pode ser embutida no app,
//   mas o texto ocupa exatamente o mesmo espaço e tem o mesmo desenho geral.
// - Alternativas com a letra dentro de um círculo e recuo alinhado.
// - Capa, folha de respostas e gabarito (com comentários, quando houver).
// ============================================================================

import { APOSTILA_AMBER, PDF_EXPORT_MAX, type RGB } from "./apostilaTheme";

const PAGE_W = 210;
const PAGE_H = 297;
const MX = 14;
const GUTTER = 8;
const COL_W = (PAGE_W - MX * 2 - GUTTER) / 2;
const TOP = 19;
const BOTTOM = PAGE_H - 17;
const TEXT: RGB = [28, 28, 34];
const MUTED: RGB = [112, 112, 124];
const WARN: RGB = [180, 83, 9];

const BODY_SIZE = 11;
const LH = 4.85; // entrelinha para 11 pt (~1,25)
const PT = 0.3528;

const FONT_FILES = {
  normal: "LiberationSans-Regular.ttf",
  bold: "LiberationSans-Bold.ttf",
  italic: "LiberationSans-Italic.ttf",
} as const;
const FONT = "LiberationSans";

let fontCache: Promise<Record<string, string>> | null = null;

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  }
  return btoa(binary);
}

function loadFonts(): Promise<Record<string, string>> {
  if (!fontCache) {
    fontCache = Promise.all(
      Object.values(FONT_FILES).map(async (file) => {
        const res = await fetch(`/fonts/liberation-sans/${file}`);
        if (!res.ok) throw new Error(`fonte ${file}: ${res.status}`);
        return [file, toBase64(await res.arrayBuffer())] as const;
      })
    )
      .then((entries) => Object.fromEntries(entries))
      .catch((err) => {
        fontCache = null;
        throw err;
      });
  }
  return fontCache;
}

function tint(c: RGB, amount: number): RGB {
  return c.map((v) => Math.round(v + (255 - v) * amount)) as RGB;
}

export interface ApostilaOptions {
  studentName?: string;
  title?: string;
  /** Linha abaixo do título na capa (ex.: filtros aplicados). */
  subtitle?: string;
  /** Numeração começa em offset + 1 (usado ao dividir em partes). */
  offset?: number;
  includeGabarito?: boolean;
  includeComentarios?: boolean;
  includeFolhaRespostas?: boolean;
  accent?: RGB;
  /** Cores por grande área para a capa (slug → RGB). */
  areaColors?: Record<string, RGB>;
  part?: { index: number; total: number };
  onProgress?: (done: number, total: number) => void;
}

interface Ctx {
  doc: jsPDF;
  font: string;
  accent: RGB;
  col: number;
  y: number;
  twoColumnPages: Set<number>;
}

function setFont(ctx: Ctx, style: "normal" | "bold" | "italic", size: number, color: RGB = TEXT) {
  ctx.doc.setFont(ctx.font, style);
  ctx.doc.setFontSize(size);
  ctx.doc.setTextColor(...color);
}

function colX(ctx: Ctx) {
  return MX + ctx.col * (COL_W + GUTTER);
}

function newColumnPage(ctx: Ctx) {
  ctx.doc.addPage();
  ctx.twoColumnPages.add(ctx.doc.getNumberOfPages());
  ctx.col = 0;
  ctx.y = TOP;
}

function nextColumn(ctx: Ctx) {
  if (ctx.col === 0) {
    ctx.col = 1;
    ctx.y = TOP;
  } else newColumnPage(ctx);
}

function ensure(ctx: Ctx, height: number) {
  if (ctx.y + height > BOTTOM) nextColumn(ctx);
}

function truncate(doc: jsPDF, text: string, width: number): string {
  if (doc.getTextWidth(text) <= width) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (doc.getTextWidth(text.slice(0, mid) + "…") <= width) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo).trimEnd() + "…";
}

/** Quebra de linha gulosa que também quebra palavras compostas no hífen
 * ("apresenta-" / "se"), o que deixa o texto justificado bem mais uniforme. */
function wrapLines(doc: jsPDF, paragraph: string, width: number): string[] {
  const lines: string[] = [];
  let current = "";
  const fits = (t: string) => doc.getTextWidth(t) <= width;
  for (const word of paragraph.split(" ")) {
    const candidate = current ? `${current} ${word}` : word;
    if (fits(candidate)) {
      current = candidate;
      continue;
    }
    // Tenta quebrar no último hífen que ainda cabe na linha.
    let placed = false;
    const hyphens = Array.from(word.matchAll(/-/g)).map((m) => m.index ?? -1).filter((i) => i > 0 && i < word.length - 1);
    for (let h = hyphens.length - 1; h >= 0; h--) {
      const head = word.slice(0, hyphens[h] + 1);
      const withHead = current ? `${current} ${head}` : head;
      if (fits(withHead)) {
        lines.push(withHead);
        current = word.slice(hyphens[h] + 1);
        placed = true;
        break;
      }
    }
    if (placed) continue;
    if (current) lines.push(current);
    if (fits(word)) current = word;
    else {
      // Palavra maior que a coluna (URL): corta em pedaços.
      const pieces = doc.splitTextToSize(word, width) as string[];
      lines.push(...pieces.slice(0, -1));
      current = pieces[pieces.length - 1] ?? "";
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Uma linha justificada: distribui a sobra entre os espaços. */
function drawJustifiedLine(doc: jsPDF, line: string, x: number, y: number, width: number) {
  const words = line.split(" ").filter(Boolean);
  if (words.length < 2) {
    doc.text(line, x, y);
    return;
  }
  const widths = words.map((w) => doc.getTextWidth(w));
  const gap = (width - widths.reduce((a, b) => a + b, 0)) / (words.length - 1);
  // Só uma ou duas palavras numa linha (ex.: URL longa) ficariam "esgarçadas": alinha à esquerda.
  if (words.length < 3 && gap > doc.getTextWidth(" ") * 4) {
    doc.text(line, x, y);
    return;
  }
  let cx = x;
  words.forEach((w, i) => {
    doc.text(w, cx, y);
    cx += widths[i] + gap;
  });
}

/** Parágrafos justificados que fluem de coluna em coluna / página em página. */
function writeText(
  ctx: Ctx,
  text: string,
  opts: {
    style?: "normal" | "bold" | "italic";
    size?: number;
    color?: RGB;
    indent?: number;
    lineHeight?: number;
    justify?: boolean;
    /** Desenho extra na 1ª linha (ex.: círculo da alternativa). */
    onFirstLine?: (x: number, baseline: number) => void;
  } = {}
) {
  const { style = "normal", size = BODY_SIZE, color = TEXT, indent = 0, lineHeight = LH, justify = true } = opts;
  const width = COL_W - indent;
  const paragraphs = text
    .split(/\n+/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  let first = true;
  for (const paragraph of paragraphs) {
    setFont(ctx, style, size, color);
    const lines = wrapLines(ctx.doc, paragraph, width);
    lines.forEach((line, i) => {
      ensure(ctx, lineHeight);
      setFont(ctx, style, size, color);
      const x = colX(ctx) + indent;
      const baseline = ctx.y + lineHeight * 0.74;
      if (justify && i < lines.length - 1) drawJustifiedLine(ctx.doc, line, x, baseline, width);
      else ctx.doc.text(line, x, baseline);
      if (first && opts.onFirstLine) opts.onFirstLine(colX(ctx), baseline);
      first = false;
      ctx.y += lineHeight;
    });
  }
}

function origemLabel(q: Question): string {
  if (q.banca === "INEP") return `Revalida${q.ano ? ` ${q.ano}` : ""}`;
  if (q.banca) return `${q.banca}${q.ano ? ` ${q.ano}` : ""}`;
  if (q.origem === "ia") return "Quiz IA";
  return q.colecao?.startsWith("Coletânea") ? "Coletânea" : q.colecao ?? "";
}

function writeQuestion(ctx: Ctx, q: Question, numero: number, areaColor: RGB) {
  const { doc, accent } = ctx;
  // Cabeçalho + 3 linhas ficam juntos (não deixa "Questão 12" sozinha no pé da coluna).
  ensure(ctx, 11 + LH * 3);
  const x = colX(ctx);

  doc.setFillColor(...tint(accent, 0.86));
  doc.roundedRect(x, ctx.y, COL_W, 6.4, 1.4, 1.4, "F");
  doc.setFillColor(...accent);
  doc.roundedRect(x, ctx.y, 1.6, 6.4, 0.8, 0.8, "F");
  setFont(ctx, "bold", 9, accent);
  const label = `QUESTÃO ${numero}`;
  doc.text(label, x + 3.6, ctx.y + 4.4);
  const labelW = doc.getTextWidth(label);
  setFont(ctx, "bold", 7.5, MUTED);
  const origem = truncate(doc, origemLabel(q), COL_W - labelW - 10);
  doc.text(origem, x + COL_W - 2.4, ctx.y + 4.3, { align: "right" });
  if (q.anulada) {
    setFont(ctx, "bold", 7, WARN);
    doc.text("ANULADA", x + 3.6 + labelW + 3, ctx.y + 4.3);
  }
  ctx.y += 6.4 + 1.2;

  const path = [q.subjectName, q.especialidade !== q.subjectName ? q.especialidade : undefined, q.tema]
    .filter(Boolean)
    .join(" · ");
  setFont(ctx, "normal", 7.5, areaColor);
  doc.text(truncate(doc, path.toUpperCase(), COL_W), x, ctx.y + 2.7);
  ctx.y += 4.2;

  if (q.secao) {
    writeText(ctx, q.secao, { style: "italic", size: 8.5, color: MUTED, lineHeight: 3.8, justify: false });
    ctx.y += 0.6;
  }

  writeText(ctx, reflowText(q.enunciado));

  if (q.hasImage) {
    ctx.y += 0.6;
    writeText(ctx, "[Esta questão tem imagem na prova original — consulte a fonte.]", {
      style: "italic",
      size: 8.5,
      color: WARN,
      lineHeight: 3.8,
      justify: false,
    });
  }
  ctx.y += 1.8;

  const INDENT = 7;
  for (const alt of q.alternatives) {
    ensure(ctx, LH + 0.8);
    writeText(ctx, reflowText(alt.text).replace(/\n/g, " "), {
      indent: INDENT,
      onFirstLine: (cx, baseline) => {
        const cy = baseline - 1.35;
        doc.setDrawColor(...accent);
        doc.setLineWidth(0.3);
        doc.setFillColor(255, 255, 255);
        doc.circle(cx + 2.5, cy, 2.25, "FD");
        setFont(ctx, "bold", 8, accent);
        doc.text(alt.letter, cx + 2.5, cy + 1.05, { align: "center" });
        setFont(ctx, "normal", BODY_SIZE, TEXT);
      },
    });
    ctx.y += 0.9;
  }

  ctx.y += 2.4;
  if (ctx.y + 5 <= BOTTOM) {
    const sx = colX(ctx);
    doc.setDrawColor(...tint(accent, 0.55));
    doc.setLineWidth(0.25);
    doc.setLineDashPattern([0.6, 1.2], 0);
    doc.line(sx + COL_W * 0.25, ctx.y, sx + COL_W * 0.75, ctx.y);
    doc.setLineDashPattern([], 0);
    ctx.y += 4.4;
  } else nextColumn(ctx);
}

function drawCover(
  ctx: Ctx,
  batch: Question[],
  options: ApostilaOptions,
  first: number,
  last: number
) {
  const { doc, accent } = ctx;
  const bandH = 104;
  doc.setFillColor(...accent);
  doc.rect(0, 0, PAGE_W, bandH, "F");

  // Motivo decorativo: anéis concêntricos + traçado de ECG.
  doc.setDrawColor(...tint(accent, 0.3));
  doc.setLineWidth(0.5);
  for (let r = 18; r <= 90; r += 12) doc.circle(PAGE_W - 12, 18, r, "S");
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.8);
  const ecg: [number, number][] = [
    [0, 88], [60, 88], [66, 80], [71, 96], [77, 70], [83, 92], [88, 88], [210, 88],
  ];
  for (let i = 1; i < ecg.length; i++) doc.line(ecg[i - 1][0], ecg[i - 1][1], ecg[i][0], ecg[i][1]);

  setFont(ctx, "bold", 11, [255, 255, 255]);
  doc.text("MEDSTUDY HUB", MX + 2, 26, { charSpace: 1.2 });
  setFont(ctx, "bold", 32, [255, 255, 255]);
  doc.text(options.title ?? "Apostila de Questões", MX + 2, 46);
  if (options.part && options.part.total > 1) {
    setFont(ctx, "bold", 13, tint(accent, 0.75));
    doc.text(`Parte ${options.part.index} de ${options.part.total}`, MX + 2, 55);
  }
  if (options.subtitle) {
    setFont(ctx, "normal", 11, tint(accent, 0.82));
    const lines = (doc.splitTextToSize(options.subtitle, PAGE_W - MX * 2 - 4) as string[]).slice(0, 3);
    doc.text(lines, MX + 2, options.part && options.part.total > 1 ? 63 : 57);
  }

  // Ficha
  let y = bandH + 16;
  const student = options.studentName?.trim() || "____________________________________";
  const info: [string, string][] = [
    ["Aluno(a)", student],
    ["Data", new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })],
    ["Questões", `${first} a ${last}  (${batch.length} ${batch.length === 1 ? "questão" : "questões"})`],
    [
      "Neste arquivo",
      [
        "enunciados em duas colunas",
        options.includeFolhaRespostas ? "folha de respostas" : null,
        options.includeGabarito ? "gabarito no final" : "sem gabarito (modo simulado)",
      ]
        .filter(Boolean)
        .join(" · "),
    ],
  ];
  for (const [k, v] of info) {
    setFont(ctx, "bold", 8, MUTED);
    doc.text(k.toUpperCase(), MX + 2, y, { charSpace: 0.4 });
    setFont(ctx, "normal", 12, TEXT);
    doc.text(truncate(doc, v, PAGE_W - MX * 2 - 44), MX + 42, y);
    doc.setDrawColor(230, 230, 236);
    doc.setLineWidth(0.2);
    doc.line(MX + 2, y + 3.4, PAGE_W - MX - 2, y + 3.4);
    y += 11;
  }

  // Distribuição por grande área
  y += 8;
  setFont(ctx, "bold", 11, TEXT);
  doc.text("Distribuição por grande área", MX + 2, y);
  y += 7;
  const counts = new Map<string, { name: string; n: number; slug: string }>();
  for (const q of batch) {
    const c = counts.get(q.subjectSlug) ?? { name: q.subjectName, n: 0, slug: q.subjectSlug };
    c.n++;
    counts.set(q.subjectSlug, c);
  }
  const rows = Array.from(counts.values()).sort((a, b) => b.n - a.n);
  const maxN = Math.max(...rows.map((r) => r.n));
  const barX = MX + 62;
  const barW = PAGE_W - MX - 2 - barX - 16;
  for (const row of rows.slice(0, 8)) {
    const color = options.areaColors?.[row.slug] ?? accent;
    setFont(ctx, "normal", 10, TEXT);
    doc.text(truncate(doc, row.name, 56), MX + 2, y + 3);
    doc.setFillColor(240, 240, 244);
    doc.roundedRect(barX, y, barW, 4, 2, 2, "F");
    doc.setFillColor(...color);
    doc.roundedRect(barX, y, Math.max(4, (row.n / maxN) * barW), 4, 2, 2, "F");
    setFont(ctx, "bold", 10, TEXT);
    doc.text(String(row.n), PAGE_W - MX - 2, y + 3.2, { align: "right" });
    y += 8;
  }

  // Dicas
  y = Math.max(y + 10, PAGE_H - 58);
  doc.setFillColor(...tint(accent, 0.9));
  doc.roundedRect(MX, y, PAGE_W - MX * 2, 30, 3, 3, "F");
  setFont(ctx, "bold", 10, accent);
  doc.text("Como usar", MX + 6, y + 8);
  setFont(ctx, "normal", 9.5, TEXT);
  doc.text(
    doc.splitTextToSize(
      "Resolva no seu ritmo e marque a letra na folha de respostas. Risque as alternativas que você descartar — " +
        "treinar a eliminação é tão importante quanto acertar. Confira o gabarito só no final e volte à plataforma " +
        "para revisar as que errou com o cronômetro, estatísticas e aulas relacionadas.",
      PAGE_W - MX * 2 - 12
    ) as string[],
    MX + 6,
    y + 14
  );
}

function drawAnswerSheet(ctx: Ctx, batch: Question[], offset: number) {
  const { doc, accent } = ctx;
  doc.addPage();
  let y = TOP + 4;
  setFont(ctx, "bold", 16, accent);
  doc.text("Folha de respostas", MX, y);
  setFont(ctx, "normal", 9, MUTED);
  doc.text("Preencha o círculo da alternativa escolhida.", MX, y + 6);
  y += 14;

  const cols = 4;
  const colW = (PAGE_W - MX * 2) / cols;
  const rowH = 6.2;
  const rowsPerPage = Math.floor((BOTTOM - y) / rowH);
  let startY = y;
  batch.forEach((q, i) => {
    const pageIndex = Math.floor(i / (rowsPerPage * cols));
    const within = i % (rowsPerPage * cols);
    if (within === 0 && pageIndex > 0) {
      doc.addPage();
      startY = TOP + 4;
    }
    const col = Math.floor(within / rowsPerPage);
    const row = within % rowsPerPage;
    const x = MX + col * colW;
    const ry = startY + row * rowH;
    if (row % 2 === 0) {
      doc.setFillColor(248, 248, 250);
      doc.rect(x, ry - 4.1, colW - 3, rowH, "F");
    }
    setFont(ctx, "bold", 8.5, TEXT);
    doc.text(String(offset + i + 1).padStart(3, " "), x + 8, ry, { align: "right" });
    q.alternatives.forEach((alt, j) => {
      const cx = x + 13 + j * 6.4;
      doc.setDrawColor(...(q.anulada ? tint(MUTED, 0.5) : accent));
      doc.setLineWidth(0.25);
      doc.circle(cx, ry - 1.1, 2.2, "S");
      setFont(ctx, "normal", 6.5, q.anulada ? tint(MUTED, 0.3) : MUTED);
      doc.text(alt.letter, cx, ry - 0.2, { align: "center" });
    });
  });
}

function drawGabarito(ctx: Ctx, batch: Question[], offset: number, includeComentarios: boolean) {
  const { doc, accent } = ctx;
  doc.addPage();
  let y = TOP + 4;
  setFont(ctx, "bold", 16, accent);
  doc.text("Gabarito", MX, y);
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.6);
  doc.line(MX, y + 2.6, MX + 24, y + 2.6);
  y += 10;

  const cols = 8;
  const cellW = (PAGE_W - MX * 2) / cols;
  const cellH = 8.4;
  batch.forEach((q, i) => {
    const col = i % cols;
    if (i > 0 && col === 0) y += cellH + 1.4;
    if (y + cellH > BOTTOM) {
      doc.addPage();
      y = TOP + 4;
    }
    const x = MX + col * cellW;
    doc.setFillColor(...(q.anulada ? [245, 245, 247] as RGB : tint(accent, 0.9)));
    doc.roundedRect(x + 0.6, y, cellW - 1.2, cellH, 1.6, 1.6, "F");
    setFont(ctx, "normal", 8, MUTED);
    doc.text(String(offset + i + 1), x + 2.6, y + 5.5);
    if (q.anulada || !q.gabarito) {
      setFont(ctx, "bold", 7, WARN);
      doc.text("ANUL.", x + cellW - 2.6, y + 5.4, { align: "right" });
    } else {
      setFont(ctx, "bold", 12, accent);
      doc.text(q.gabarito, x + cellW - 3.2, y + 5.9, { align: "right" });
    }
  });

  const comentadas = includeComentarios ? batch.map((q, i) => ({ q, n: offset + i + 1 })).filter(({ q }) => q.comentario && !q.anulada) : [];
  if (comentadas.length > 0) {
    newColumnPage(ctx);
    setFont(ctx, "bold", 14, accent);
    ctx.doc.text("Comentários", MX, ctx.y + 4);
    ctx.y += 9;
    for (const { q, n } of comentadas) {
      ensure(ctx, LH * 3);
      writeText(ctx, `Questão ${n} — ${q.anulada ? "anulada" : q.gabarito}`, { style: "bold", size: 10, color: accent, justify: false });
      writeText(ctx, reflowText(q.comentario ?? ""), { size: 10, lineHeight: 4.4 });
      ctx.y += 3;
    }
  }
}

function decoratePages(ctx: Ctx, options: ApostilaOptions, first: number, last: number) {
  const { doc, accent } = ctx;
  const total = doc.getNumberOfPages();
  const student = options.studentName?.trim();
  for (let p = 2; p <= total; p++) {
    doc.setPage(p);

    // Marca d'água discreta
    doc.saveGraphicsState();
    doc.setGState(doc.GState({ opacity: 0.035 }));
    setFont(ctx, "bold", 64, accent);
    doc.text("MedStudy Hub", PAGE_W / 2, PAGE_H / 2 + 10, { align: "center", angle: 35 });
    doc.restoreGraphicsState();

    // Cabeçalho
    setFont(ctx, "bold", 7.5, accent);
    const brand = "MEDSTUDY HUB";
    doc.text(brand, MX, 10.5, { charSpace: 0.6 });
    const brandW = doc.getTextWidth(brand) + brand.length * 0.6;
    setFont(ctx, "normal", 7.5, MUTED);
    doc.text(truncate(doc, `·  ${options.title ?? "Apostila de Questões"}`, 90), MX + brandW + 2, 10.5);
    if (student) doc.text(truncate(doc, student, 60), PAGE_W - MX, 10.5, { align: "right" });
    doc.setDrawColor(...accent);
    doc.setLineWidth(0.35);
    doc.line(MX, 13, PAGE_W - MX, 13);

    // Fio entre as colunas, na cor temática
    if (ctx.twoColumnPages.has(p)) {
      doc.setDrawColor(...accent);
      doc.setLineWidth(0.4);
      doc.line(PAGE_W / 2, TOP - 1, PAGE_W / 2, BOTTOM + 1);
    }

    // Rodapé
    doc.setDrawColor(228, 228, 234);
    doc.setLineWidth(0.2);
    doc.line(MX, PAGE_H - 11.5, PAGE_W - MX, PAGE_H - 11.5);
    setFont(ctx, "normal", 7.5, MUTED);
    doc.text(`Questões ${first}–${last}`, MX, PAGE_H - 7);
    setFont(ctx, "bold", 8, accent);
    doc.text(`${p} / ${total}`, PAGE_W - MX, PAGE_H - 7, { align: "right" });
  }
}

/**
 * Gera e baixa a apostila. `questions` já deve estar na ordem e na quantidade
 * que o aluno escolheu; acima de PDF_EXPORT_MAX o chamador divide em partes
 * (via `offset`/`part`).
 */
export async function exportApostilaPdf(questions: Question[], options: ApostilaOptions = {}): Promise<void> {
  const offset = options.offset ?? 0;
  const batch = questions.slice(0, PDF_EXPORT_MAX);
  if (batch.length === 0) return;

  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  let font = "helvetica";
  try {
    const files = await loadFonts();
    for (const [style, file] of Object.entries(FONT_FILES)) {
      doc.addFileToVFS(file, files[file]);
      doc.addFont(file, FONT, style);
    }
    font = FONT;
  } catch {
    // Sem as fontes (offline): cai para Helvetica, que tem as mesmas medidas.
  }

  const accent = options.accent ?? APOSTILA_AMBER;
  const ctx: Ctx = { doc, font, accent, col: 0, y: TOP, twoColumnPages: new Set() };
  const first = offset + 1;
  const last = offset + batch.length;

  drawCover(ctx, batch, options, first, last);
  newColumnPage(ctx);

  for (let i = 0; i < batch.length; i++) {
    const q = batch[i];
    writeQuestion(ctx, q, offset + i + 1, options.areaColors?.[q.subjectSlug] ?? MUTED);
    if (i % 25 === 24) {
      options.onProgress?.(i + 1, batch.length);
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  if (options.includeFolhaRespostas ?? true) drawAnswerSheet(ctx, batch, offset);
  if (options.includeGabarito ?? true) drawGabarito(ctx, batch, offset, options.includeComentarios ?? true);

  decoratePages(ctx, options, first, last);
  options.onProgress?.(batch.length, batch.length);

  const suffix = options.includeGabarito === false ? "-sem-gabarito" : "";
  doc.save(`apostila-medstudy-${first}-${last}${suffix}.pdf`);
}
