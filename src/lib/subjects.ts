// ============================================================================
// Resolução de disciplinas (spec v2)
//
// Diferente da v1 (que inferia a disciplina a partir do nome do arquivo),
// a v2 recebe a disciplina explicitamente na coluna "Disciplina" da
// planilha. Este módulo só precisa:
//   1. reconhecer variações comuns de nome/sigla de disciplinas médicas
//      conhecidas, para reaproveitar cor/ícone/nome canônico consistentes;
//   2. sintetizar uma disciplina nova (cor/ícone determinísticos) quando o
//      usuário importa uma disciplina fora dessa lista — a plataforma não
//      fica travada em um catálogo fixo.
// ============================================================================

import { seededHash, slugify, normalizeText } from "./utils";
import type { StudyContent, Question, Subject } from "./types";

// As 5 grandes áreas do ENAMED (Exame Nacional de Avaliação da Formação
// Médica) — o catálogo de disciplinas do ciclo básico (anatomia, bioquímica
// etc.) foi removido de propósito: a plataforma passa a organizar tudo em
// torno dessas áreas, cada uma subdividida em "frentes" (o campo `modulo`
// de StudyContent/Question, ex.: CIR1, CIR2..., GIN1..., OBS1..., PED1...,
// MFC1...) em vez de uma nova disciplina por assunto.
export const KNOWN_SUBJECTS: Subject[] = [
  { slug: "clinica-medica", name: "Clínica Médica", colorToken: "210 80% 55%", icon: "HeartPulse" },
  { slug: "cirurgia-geral", name: "Cirurgia Geral", colorToken: "0 72% 55%", icon: "Scissors" },
  { slug: "ginecologia-obstetricia", name: "Ginecologia e Obstetrícia", colorToken: "320 65% 58%", icon: "Heart" },
  { slug: "pediatria", name: "Pediatria", colorToken: "38 92% 50%", icon: "Baby" },
  { slug: "preventiva-mfc", name: "Preventiva e MFC", colorToken: "152 55% 45%", icon: "ShieldCheck" },
];

const SUBJECT_ALIASES: Record<string, string> = {
  "clinica medica": "clinica-medica",
  "medicina interna": "clinica-medica",
  clinica: "clinica-medica",
  clm: "clinica-medica",
  cm: "clinica-medica",

  cirurgia: "cirurgia-geral",
  "cirurgia geral": "cirurgia-geral",
  cir: "cirurgia-geral",
  cx: "cirurgia-geral",

  ginecologia: "ginecologia-obstetricia",
  "ginecologia e obstetricia": "ginecologia-obstetricia",
  obstetricia: "ginecologia-obstetricia",
  "gineco obstetricia": "ginecologia-obstetricia",
  gineco: "ginecologia-obstetricia",
  gin: "ginecologia-obstetricia",
  obs: "ginecologia-obstetricia",
  go: "ginecologia-obstetricia",

  pediatria: "pediatria",
  pedia: "pediatria",
  pedi: "pediatria",
  ped: "pediatria",

  "preventiva e mfc": "preventiva-mfc",
  "medicina preventiva": "preventiva-mfc",
  "medicina preventiva e social": "preventiva-mfc",
  "medicina de familia e comunidade": "preventiva-mfc",
  "saude coletiva": "preventiva-mfc",
  "saude publica": "preventiva-mfc",
  preventiva: "preventiva-mfc",
  mfc: "preventiva-mfc",
  prm: "preventiva-mfc",
  sus: "preventiva-mfc",

  // --- Sub-especialidades (mapeadas para as 5 grandes áreas do ENAMED) ------
  // Vistas nos cursinhos reais mapeados (MedCel, EstratégiaMED, MedCurso,
  // Sanar) — usadas pela classificação automática da Biblioteca (seção
  // "Por Grande Área"), nunca como disciplina nova: sempre resolvem para uma
  // das 5 áreas conhecidas.
  cardiologia: "clinica-medica",
  dermatologia: "clinica-medica",
  endocrinologia: "clinica-medica",
  gastroenterologia: "clinica-medica",
  gastrologia: "clinica-medica",
  geriatria: "clinica-medica",
  hematologia: "clinica-medica",
  hepatologia: "clinica-medica",
  infectologia: "clinica-medica",
  "medicina intensiva": "clinica-medica",
  nefrologia: "clinica-medica",
  neurologia: "clinica-medica",
  oftalmologia: "clinica-medica",
  otorrinolaringologia: "cirurgia-geral",
  pneumologia: "clinica-medica",
  psiquiatria: "clinica-medica",
  radiologia: "clinica-medica",
  reumatologia: "clinica-medica",
  urologia: "cirurgia-geral",
  ortopedia: "cirurgia-geral",
  "cirurgia pediatrica": "cirurgia-geral",
  "cirurgia vascular": "cirurgia-geral",
  "cirurgia do trauma": "cirurgia-geral",
  "especialidades cirurgicas": "cirurgia-geral",
};

// Paleta usada para sintetizar cor/ícone de disciplinas fora do catálogo
// conhecido — determinística (mesmo nome -> sempre a mesma cor/ícone).
const PALETTE: { colorToken: string; icon: string }[] = [
  { colorToken: "217 65% 45%", icon: "BookOpen" },
  { colorToken: "168 60% 38%", icon: "Leaf" },
  { colorToken: "291 55% 52%", icon: "Brain" },
  { colorToken: "24 80% 48%", icon: "Flame" },
  { colorToken: "199 70% 40%", icon: "Droplet" },
  { colorToken: "142 55% 38%", icon: "Sprout" },
  { colorToken: "340 65% 50%", icon: "Syringe" },
  { colorToken: "48 80% 42%", icon: "Sun" },
];

/** Remove sufixos de ruído comuns nos nomes de área dos cursinhos mapeados
 * (ex.: "Cardiologia - Extensivo", "Nefrologia - Extensivo 9") antes de
 * tentar casar com uma grande área conhecida. */
export function stripSubjectNoise(text: string): string {
  return text
    .replace(/-?\s*extensivo\s*\d*$/i, "")
    .replace(/-?\s*curso extensivo$/i, "")
    .trim();
}

/** Tenta casar um texto livre (nome de área, segmento de pasta, nome de
 * curso...) com uma das 5 grandes áreas conhecidas — ao contrário de
 * `resolveSubject`, NUNCA sintetiza uma disciplina nova: retorna `undefined`
 * quando não há correspondência confiável, para que o chamador possa tratar
 * o item como "a classificar" em vez de forçar uma área errada. */
export function matchKnownSubject(raw: string): Subject | undefined {
  const trimmed = stripSubjectNoise(raw.trim());
  if (!trimmed) return undefined;
  const normalized = normalizeText(trimmed);

  const exactAlias = SUBJECT_ALIASES[normalized];
  if (exactAlias) return KNOWN_SUBJECTS.find((s) => s.slug === exactAlias);

  const exactSlug = KNOWN_SUBJECTS.find((s) => s.slug === slugify(trimmed));
  if (exactSlug) return exactSlug;

  // Correspondência por substring — só para chaves com 4+ caracteres, para
  // não deixar siglas curtas ("go", "cx"...) darem falso positivo dentro de
  // outra palavra qualquer.
  const bySubstring = Object.entries(SUBJECT_ALIASES)
    .filter(([key]) => key.length >= 4)
    .sort((a, b) => b[0].length - a[0].length);
  for (const [key, slug] of bySubstring) {
    if (normalized.includes(key)) return KNOWN_SUBJECTS.find((s) => s.slug === slug);
  }

  return undefined;
}

/** Resolve o nome de disciplina de uma linha da planilha para um Subject
 * consistente — reaproveitando o catálogo conhecido quando reconhece, ou
 * sintetizando uma disciplina nova (cor/ícone determinísticos) caso contrário. */
export function resolveSubject(disciplinaRaw: string): Subject {
  const trimmed = disciplinaRaw.trim();
  const normalized = normalizeText(trimmed);
  const aliasSlug = SUBJECT_ALIASES[normalized];
  if (aliasSlug) {
    const known = KNOWN_SUBJECTS.find((s) => s.slug === aliasSlug);
    if (known) return known;
  }

  const slug = slugify(trimmed);
  const known = KNOWN_SUBJECTS.find((s) => s.slug === slug);
  if (known) return known;

  const palette = PALETTE[seededHash(slug) % PALETTE.length];
  return { slug, name: trimmed || "Disciplina", colorToken: palette.colorToken, icon: palette.icon };
}

/** Lista de disciplinas distintas presentes no conteúdo/questões, na ordem alfabética. */
export function getSubjectsFromItems(items: { subjectName: string }[]): Subject[] {
  const bySlug = new Map<string, Subject>();
  for (const item of items) {
    const subject = resolveSubject(item.subjectName);
    if (!bySlug.has(subject.slug)) bySlug.set(subject.slug, subject);
  }
  return Array.from(bySlug.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function getSubjectsFromContentAndQuestions(content: StudyContent[], questions: Question[]): Subject[] {
  return getSubjectsFromItems([...content, ...questions]);
}
