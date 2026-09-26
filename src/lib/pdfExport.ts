import { jsPDF } from "jspdf";
import type { Question } from "./types";

/** Máximo de questões por exportação, para evitar PDFs gigantes/travamentos. */
export const PDF_EXPORT_MAX = 100;

const MARGIN = 16;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const PRIMARY: [number, number, number] = [217, 119, 6];
const MUTED: [number, number, number] = [110, 110, 120];
const TEXT: [number, number, number] = [30, 30, 35];

function addWatermark(doc: jsPDF) {
  doc.saveGraphicsState();
  doc.setGState(doc.GState({ opacity: 0.06 }));
  doc.setFontSize(60);
  doc.setTextColor(...PRIMARY);
  doc.text("MedStudy Hub", PAGE_WIDTH / 2, PAGE_HEIGHT / 2, { align: "center", angle: 35 });
  doc.restoreGraphicsState();
}

function addFooter(doc: jsPDF, page: number, totalPages: number) {
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("MedStudy Hub", MARGIN, PAGE_HEIGHT - 8);
  doc.text(`Página ${page} de ${totalPages}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 8, { align: "right" });
}

interface Cursor {
  y: number;
}

function ensureSpace(doc: jsPDF, cursor: Cursor, needed: number) {
  if (cursor.y + needed > PAGE_HEIGHT - 22) {
    doc.addPage();
    cursor.y = MARGIN;
  }
}

function writeParagraph(doc: jsPDF, cursor: Cursor, text: string, opts: { fontSize: number; bold?: boolean; color?: [number, number, number]; indent?: number; lineHeight?: number }) {
  const { fontSize, bold = false, color = TEXT, indent = 0, lineHeight = fontSize * 0.42 } = opts;
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setFontSize(fontSize);
  doc.setTextColor(...color);
  const lines = doc.splitTextToSize(text, CONTENT_WIDTH - indent);
  for (const line of lines) {
    ensureSpace(doc, cursor, lineHeight);
    doc.text(line, MARGIN + indent, cursor.y);
    cursor.y += lineHeight;
  }
}

/**
 * Exporta a bateria de questões filtradas do aluno para PDF, com marca d'água
 * da plataforma, nome do aluno na capa e gabarito comentado no final. Limitado
 * a PDF_EXPORT_MAX questões por chamada — o chamador deve fatiar a lista e
 * repetir a exportação a partir do ponto onde parou, se precisar de mais.
 */
export function exportQuestionsToPdf(questions: Question[], options: { studentName?: string; offset?: number }): void {
  const offset = options.offset ?? 0;
  const batch = questions.slice(0, PDF_EXPORT_MAX);
  if (batch.length === 0) return;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const cursor: Cursor = { y: MARGIN };

  // Capa
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(...PRIMARY);
  doc.text("MedStudy Hub", MARGIN, 40);
  doc.setFontSize(14);
  doc.setTextColor(...TEXT);
  doc.text("Bateria de questões", MARGIN, 52);

  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, 58, PAGE_WIDTH - MARGIN, 58);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...TEXT);
  const studentLine = options.studentName?.trim() ? options.studentName.trim() : "Aluno(a) não identificado(a)";
  const infoLines = [
    `Aluno(a): ${studentLine}`,
    `Data de exportação: ${new Date().toLocaleDateString("pt-BR")}`,
    `Questões: ${offset + 1} a ${offset + batch.length} (${batch.length} nesta exportação)`,
  ];
  let infoY = 70;
  for (const line of infoLines) {
    doc.text(line, MARGIN, infoY);
    infoY += 7;
  }

  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(
    doc.splitTextToSize(
      "Gerado automaticamente a partir dos filtros aplicados na plataforma. O gabarito comentado está no final deste documento.",
      CONTENT_WIDTH
    ),
    MARGIN,
    infoY + 6
  );

  doc.addPage();
  cursor.y = MARGIN;

  const gabaritoEntries: { numero: number; letra: string; anulada: boolean }[] = [];

  batch.forEach((question, i) => {
    const numero = offset + i + 1;
    if (i > 0) ensureSpace(doc, cursor, 14);
    cursor.y += i === 0 ? 0 : 4;

    const headerParts = [question.subjectName, question.banca, question.ano ? String(question.ano) : undefined].filter(
      (part): part is string => Boolean(part)
    );
    writeParagraph(doc, cursor, `Questão ${numero}${headerParts.length ? " · " + headerParts.join(" · ") : ""}`, {
      fontSize: 10,
      bold: true,
      color: PRIMARY,
    });
    cursor.y += 1.5;

    writeParagraph(doc, cursor, question.enunciado, { fontSize: 10.5, lineHeight: 5 });
    cursor.y += 1.5;

    if (question.anulada) {
      writeParagraph(doc, cursor, "Questão anulada oficialmente pela banca — sem gabarito único.", {
        fontSize: 9,
        color: MUTED,
      });
      cursor.y += 1;
    }

    for (const alt of question.alternatives) {
      writeParagraph(doc, cursor, `${alt.letter}) ${alt.text}`, { fontSize: 10, indent: 4, lineHeight: 4.6 });
    }
    cursor.y += 4;

    gabaritoEntries.push({ numero, letra: question.gabarito, anulada: Boolean(question.anulada) });
  });

  // Gabarito
  doc.addPage();
  cursor.y = MARGIN;
  writeParagraph(doc, cursor, "Gabarito", { fontSize: 16, bold: true, color: PRIMARY });
  cursor.y += 4;

  const colWidth = CONTENT_WIDTH / 5;
  let col = 0;
  const rowStartY = cursor.y;
  let rowY = rowStartY;
  gabaritoEntries.forEach((entry, i) => {
    if (i > 0 && i % 5 === 0) {
      rowY += 7;
      col = 0;
      if (rowY > PAGE_HEIGHT - 22) {
        doc.addPage();
        rowY = MARGIN;
      }
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...TEXT);
    const label = entry.anulada ? `${entry.numero}. Anulada` : `${entry.numero}. ${entry.letra}`;
    doc.text(label, MARGIN + col * colWidth, rowY);
    col += 1;
  });

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    addWatermark(doc);
    addFooter(doc, p, totalPages);
  }

  doc.save(`medstudy-hub-questoes-${offset + 1}-${offset + batch.length}.pdf`);
}
