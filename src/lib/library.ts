// ============================================================================
// Biblioteca completa — navegação em árvore (Curso › Área › ...pastas › arquivo)
// sobre a lista plana carregada de public/seed-data/library-mapeamento.json.
//
// Não tentamos casar este acervo com a grade curada de Disciplinas/Cronograma
// (5 grandes áreas, módulos com prioridade/duração): são ~13,6 mil arquivos
// reais, de cursinhos e bancos de questões inteiros — a navegação segue
// exatamente a organização em pastas que o usuário já mapeou, sem reclassificar
// nada. Cada arquivo abre num player embutido do Drive (ver FilePreviewModal),
// nunca redireciona para fora da plataforma como primeira ação.
// ============================================================================

import type { ContentProgress, LibraryFile } from "./types";
import type { ClassifiedFile } from "./classification";
import type { SubjectProgress } from "./progress";
import { drivePreviewUrl, driveViewUrl } from "./driveLink";
import { KNOWN_SUBJECTS, resolveSubject } from "./subjects";
import { normalizeText } from "./utils";

export type LibraryFileKind = "video" | "pdf" | "image" | "audio" | "epub" | "outro";

const EXTENSION_KIND: Record<string, LibraryFileKind> = {
  mp4: "video",
  mov: "video",
  avi: "video",
  webm: "video",
  mkv: "video",
  pdf: "pdf",
  jpg: "image",
  jpeg: "image",
  png: "image",
  gif: "image",
  mp3: "audio",
  m4a: "audio",
  wav: "audio",
  epub: "epub",
};

export function fullPath(file: LibraryFile): string[] {
  return [file.curso, file.area, ...file.conteudo.split("›").map((s) => s.trim())].filter(Boolean);
}

export function fileName(file: LibraryFile): string {
  const parts = file.conteudo.split("›").map((s) => s.trim());
  return parts[parts.length - 1] ?? file.conteudo;
}

export function fileExtension(name: string): string {
  const m = name.match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1].toLowerCase() : "";
}

export function fileKind(file: LibraryFile): LibraryFileKind {
  return EXTENSION_KIND[fileExtension(fileName(file))] ?? "outro";
}

export function fileWebViewUrl(file: LibraryFile): string {
  return driveViewUrl(file.id);
}

export function fileEmbedUrl(file: LibraryFile): string {
  return drivePreviewUrl(file.id);
}

export interface LibraryFolderNode {
  type: "folder";
  name: string;
  path: string[];
  fileCount: number;
}

export interface LibraryFileNode {
  type: "file";
  name: string;
  path: string[];
  file: LibraryFile;
  kind: LibraryFileKind;
}

export type LibraryNode = LibraryFolderNode | LibraryFileNode;

/** Lista as pastas e arquivos diretamente dentro de `prefix` (raiz = []),
 * agrupando por próximo segmento do caminho — computado sob demanda a
 * partir da lista plana, sem manter uma árvore aninhada em memória. */
export function listChildren(files: LibraryFile[], prefix: string[]): LibraryNode[] {
  const folders = new Map<string, number>();
  const fileNodes: LibraryFileNode[] = [];

  for (const file of files) {
    const path = fullPath(file);
    if (path.length <= prefix.length) continue;
    let matches = true;
    for (let i = 0; i < prefix.length; i++) {
      if (path[i] !== prefix[i]) {
        matches = false;
        break;
      }
    }
    if (!matches) continue;

    const next = path[prefix.length];
    const isLeaf = path.length === prefix.length + 1;
    if (isLeaf) {
      fileNodes.push({ type: "file", name: next, path, file, kind: fileKind(file) });
    } else {
      folders.set(next, (folders.get(next) ?? 0) + 1);
    }
  }

  const folderNodes: LibraryFolderNode[] = Array.from(folders.entries()).map(([name, fileCount]) => ({
    type: "folder",
    name,
    path: [...prefix, name],
    fileCount,
  }));

  folderNodes.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  fileNodes.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return [...folderNodes, ...fileNodes];
}

export const UNCLASSIFIED_LABEL = "A classificar";

/** Navegação em árvore pela classificação clínica (Grande Área → Disciplina
 * → arquivo), em vez do caminho por curso/pastas de `listChildren`. Itens
 * sem `subjectSlug` (não classificados) ficam agrupados sob "A classificar",
 * um nível abaixo por curso de origem (para não virar uma lista única de
 * milhares de itens). */
export function listChildrenByGrandeArea(items: ClassifiedFile[], prefix: string[]): LibraryNode[] {
  if (prefix.length === 0) {
    const counts = new Map<string, number>();
    for (const item of items) {
      const key = item.subjectSlug ? resolveSubject(item.subjectSlug).name : UNCLASSIFIED_LABEL;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const order = [...KNOWN_SUBJECTS.map((s) => s.name), UNCLASSIFIED_LABEL];
    return order
      .filter((name) => counts.has(name))
      .map((name) => ({ type: "folder" as const, name, path: [name], fileCount: counts.get(name)! }));
  }

  const grandeAreaName = prefix[0];
  const isUnclassifiedBucket = grandeAreaName === UNCLASSIFIED_LABEL;
  const scoped = items.filter((item) =>
    isUnclassifiedBucket ? !item.subjectSlug : item.subjectSlug && resolveSubject(item.subjectSlug).name === grandeAreaName
  );
  const groupOf = (item: ClassifiedFile) => (isUnclassifiedBucket ? item.curso : item.disciplina || "Outros");

  if (prefix.length === 1) {
    const counts = new Map<string, number>();
    for (const item of scoped) counts.set(groupOf(item), (counts.get(groupOf(item)) ?? 0) + 1);
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
      .map(([name, fileCount]) => ({ type: "folder" as const, name, path: [...prefix, name], fileCount }));
  }

  const groupName = prefix[1];
  return scoped
    .filter((item) => groupOf(item) === groupName)
    .map((item) => ({ type: "file" as const, name: fileName(item), path: [...prefix, fileName(item)], file: item, kind: fileKind(item) }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

function isLibraryItemComplete(kind: LibraryFileKind, state?: ContentProgress): boolean {
  if (!state) return false;
  return kind === "video" ? state.watchStatus === "assistida" : state.readStatus === "estudado";
}

/** Mesma agregação de `src/lib/progress.ts#computeSubjectProgress`, mas a
 * partir do acervo real classificado em vez do StudyContent[] de exemplo —
 * usa a MESMA store de progresso (chave = ID do arquivo do Drive), então o
 * progresso é sempre o mesmo não importa por onde o item foi aberto. */
export function computeSubjectProgressFromLibrary(
  items: ClassifiedFile[],
  userStates: Record<string, ContentProgress>
): SubjectProgress[] {
  const bySubject = new Map<string, ClassifiedFile[]>();
  for (const item of items) {
    if (!item.subjectSlug) continue;
    const list = bySubject.get(item.subjectSlug) ?? [];
    list.push(item);
    bySubject.set(item.subjectSlug, list);
  }

  const result: SubjectProgress[] = [];
  for (const [slug, subjectItems] of bySubject.entries()) {
    const meta = resolveSubject(slug);
    const lessons = subjectItems.filter((i) => fileKind(i) === "video");
    const materials = subjectItems.filter((i) => fileKind(i) !== "video");
    const watchedLessons = lessons.filter((i) => isLibraryItemComplete("video", userStates[i.id])).length;
    const studiedMaterials = materials.filter((i) => isLibraryItemComplete("pdf", userStates[i.id])).length;
    const totalItems = subjectItems.length;
    const completedItems = watchedLessons + studiedMaterials;
    result.push({
      slug,
      name: meta.name,
      colorToken: meta.colorToken,
      icon: meta.icon,
      totalLessons: lessons.length,
      watchedLessons,
      totalMaterials: materials.length,
      studiedMaterials,
      totalItems,
      completedItems,
      percent: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
    });
  }

  return result.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/** Busca por nome de arquivo/curso/área em todo o acervo (ignora pasta atual) —
 * limitada a `limit` resultados para manter a lista responsiva com ~13,6 mil arquivos. */
export function searchFiles(files: LibraryFile[], query: string, limit = 150): LibraryFileNode[] {
  const q = normalizeText(query);
  if (!q) return [];
  const results: LibraryFileNode[] = [];
  for (const file of files) {
    const path = fullPath(file);
    const haystack = normalizeText(`${file.curso} ${file.area} ${file.conteudo}`);
    if (!haystack.includes(q)) continue;
    results.push({ type: "file", name: fileName(file), path, file, kind: fileKind(file) });
    if (results.length >= limit) break;
  }
  return results;
}
