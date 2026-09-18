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

export const KNOWN_SUBJECTS: Subject[] = [
  { slug: "anatomia", name: "Anatomia", colorToken: "220 70% 50%", icon: "Bone" },
  { slug: "fisiologia", name: "Fisiologia", colorToken: "199 89% 45%", icon: "Activity" },
  { slug: "bioquimica", name: "Bioquímica", colorToken: "262 60% 55%", icon: "FlaskConical" },
  { slug: "histologia", name: "Histologia", colorToken: "280 55% 52%", icon: "Microscope" },
  { slug: "embriologia", name: "Embriologia", colorToken: "330 60% 52%", icon: "Shapes" },
  { slug: "genetica", name: "Genética", colorToken: "255 55% 55%", icon: "Dna" },
  { slug: "imunologia", name: "Imunologia", colorToken: "35 85% 48%", icon: "ShieldCheck" },
  { slug: "microbiologia", name: "Microbiologia", colorToken: "155 55% 38%", icon: "Bug" },
  { slug: "patologia", name: "Patologia", colorToken: "0 65% 50%", icon: "AlertTriangle" },
  { slug: "farmacologia", name: "Farmacologia", colorToken: "270 55% 50%", icon: "Pill" },
  { slug: "semiologia", name: "Semiologia", colorToken: "195 70% 42%", icon: "Stethoscope" },
  { slug: "clinica-medica", name: "Clínica Médica", colorToken: "210 75% 45%", icon: "HeartPulse" },
  { slug: "cirurgia", name: "Cirurgia", colorToken: "5 70% 48%", icon: "Scissors" },
  { slug: "pediatria", name: "Pediatria", colorToken: "45 85% 45%", icon: "Baby" },
  { slug: "ginecologia-obstetricia", name: "Ginecologia e Obstetrícia", colorToken: "320 60% 50%", icon: "Heart" },
  { slug: "cardiologia", name: "Cardiologia", colorToken: "0 72% 48%", icon: "HeartPulse" },
];

const SUBJECT_ALIASES: Record<string, string> = {
  anatomia: "anatomia",
  anat: "anatomia",
  fisiologia: "fisiologia",
  fisio: "fisiologia",
  bioquimica: "bioquimica",
  bioq: "bioquimica",
  histologia: "histologia",
  histo: "histologia",
  embriologia: "embriologia",
  embrio: "embriologia",
  genetica: "genetica",
  imunologia: "imunologia",
  imuno: "imunologia",
  microbiologia: "microbiologia",
  micro: "microbiologia",
  patologia: "patologia",
  patho: "patologia",
  farmacologia: "farmacologia",
  farmaco: "farmacologia",
  semiologia: "semiologia",
  semio: "semiologia",
  "clinica medica": "clinica-medica",
  clinica: "clinica-medica",
  clm: "clinica-medica",
  cirurgia: "cirurgia",
  cir: "cirurgia",
  pediatria: "pediatria",
  pedia: "pediatria",
  ped: "pediatria",
  ginecologia: "ginecologia-obstetricia",
  "ginecologia e obstetricia": "ginecologia-obstetricia",
  obstetricia: "ginecologia-obstetricia",
  gin: "ginecologia-obstetricia",
  obs: "ginecologia-obstetricia",
  go: "ginecologia-obstetricia",
  cardio: "cardiologia",
  cardiologia: "cardiologia",
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
