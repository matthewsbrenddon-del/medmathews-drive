// ============================================================================
// Classificação clínica dos itens da Biblioteca (curso_path -> grande_area).
//
// Cada item real (LibraryFile) já carrega seu caminho de pastas original
// (curso/área/subpastas/arquivo) — isso NUNCA muda. Esta camada, separada,
// tenta inferir a grande área ENAMED a partir desse caminho, sem forçar uma
// classificação errada: quando não há correspondência confiável, o item some
// classificado. `useClassifiedLibrary` (classificationStore.ts) decide, por
// item, entre essa sugestão automática e uma escolha manual do usuário.
// ============================================================================

import type { LibraryFile } from "./types";
import { matchKnownSubject, resolveSubject, stripSubjectNoise } from "./subjects";
import type { ManualClassification } from "./classificationStore";

export interface Classification {
  subjectSlug: string;
  subjectName: string;
  /** Rótulo legível da sub-especialidade/pasta que originou a classificação (ex.: "Cardiologia"). */
  disciplina: string;
}

/** Segmentos de pasta entre a área e o arquivo (exclui o nome do arquivo). */
function folderSegments(file: LibraryFile): string[] {
  const parts = file.conteudo.split("›").map((s) => s.trim());
  return parts.slice(0, -1);
}

/** Tenta inferir a grande área a partir do caminho original — tenta a
 * "Área" da planilha primeiro (sinal mais específico e local ao item),
 * depois cada subpasta, e por fim o nome do curso inteiro (sinal mais fraco,
 * mas útil quando a área é só "Curso"/"Geral"). Retorna `undefined` (item
 * fica "a classificar") quando nada bate com confiança. */
export function autoClassify(file: LibraryFile): Classification | undefined {
  const candidates = [file.area, ...folderSegments(file), file.curso];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const subject = matchKnownSubject(candidate);
    if (subject) {
      return { subjectSlug: subject.slug, subjectName: subject.name, disciplina: stripSubjectNoise(candidate) };
    }
  }
  return undefined;
}

/** Sugestão mais fraca, baseada no nome do próprio arquivo — usada só na tela
 * de classificação em lote como um "aceitar sugestão" opcional, nunca
 * aplicada automaticamente (nomes de PDF de prova são ruidosos demais para
 * confiar sem confirmação do usuário). */
export function suggestClassificationFromFileName(file: LibraryFile): Classification | undefined {
  const parts = file.conteudo.split("›").map((s) => s.trim());
  const name = parts[parts.length - 1] ?? file.conteudo;
  const subject = matchKnownSubject(name);
  if (!subject) return undefined;
  return { subjectSlug: subject.slug, subjectName: subject.name, disciplina: stripSubjectNoise(name) };
}

export interface ClassifiedFile extends LibraryFile {
  subjectSlug?: string;
  subjectName?: string;
  disciplina?: string;
  subtema?: string;
  classificationSource?: "auto" | "manual" | "planilha";
}

/** Combina o acervo bruto com os overrides manuais/planilha — override
 * explícito sempre vence a sugestão automática. Item sem nenhum dos dois
 * fica sem `subjectSlug` (== "a classificar"). */
export function classifyLibrary(files: LibraryFile[], overrides: Record<string, ManualClassification>): ClassifiedFile[] {
  return files.map((file) => {
    const manual = overrides[file.id];
    if (manual) {
      return {
        ...file,
        subjectSlug: manual.subjectSlug,
        subjectName: resolveSubject(manual.subjectSlug).name,
        disciplina: manual.disciplina,
        subtema: manual.subtema,
        classificationSource: manual.source,
      };
    }
    const auto = autoClassify(file);
    if (auto) {
      return {
        ...file,
        subjectSlug: auto.subjectSlug,
        subjectName: auto.subjectName,
        disciplina: auto.disciplina,
        classificationSource: "auto",
      };
    }
    return { ...file };
  });
}
