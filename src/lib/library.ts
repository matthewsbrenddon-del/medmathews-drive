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

export interface LibraryFileNode {
  type: "file";
  name: string;
  path: string[];
  file: LibraryFile;
  kind: LibraryFileKind;
}

export const UNCLASSIFIED_LABEL = "A classificar";

/** Ordenação "natural" (2.mp4 antes de 10.mp4) — essencial para aulas numeradas. */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });
}

/** Miniatura pública do Drive (só aparece para arquivos compartilhados por link). */
export function fileThumbnailUrl(file: LibraryFile, width = 400): string {
  return `https://drive.google.com/thumbnail?id=${file.id}&sz=w${width}`;
}

export function isFileComplete(file: LibraryFile, state?: ContentProgress): boolean {
  return isLibraryItemComplete(fileKind(file), state);
}

export function isFileStarted(file: LibraryFile, state?: ContentProgress): boolean {
  if (!state) return false;
  return Boolean(state.lastViewedAt) || state.watchStatus === "em_andamento" || state.readStatus === "acessado";
}

export type LibraryView = "area" | "curso";

export interface LibraryTreeNode {
  key: string;
  name: string;
  path: string[];
  children: LibraryTreeNode[];
  /** Arquivos diretamente neste nível (não inclui os das subpastas). */
  files: ClassifiedFile[];
  /** Total de arquivos nesta pasta e em todas as subpastas. */
  total: number;
  videos: number;
}

export function nodeKey(path: string[]): string {
  return path.join("\u0001");
}

/** Caminho de pastas de um arquivo em cada visão — a mesma lista de arquivos,
 * duas árvores diferentes. */
export function treePathFor(file: ClassifiedFile, view: LibraryView): string[] {
  const folders = fullPath(file).slice(0, -1);
  if (view === "curso") return folders;
  if (!file.subjectSlug) return [UNCLASSIFIED_LABEL, ...folders];
  return [resolveSubject(file.subjectSlug).name, file.disciplina || "Geral", file.curso];
}

export function buildLibraryTree(items: ClassifiedFile[], view: LibraryView): LibraryTreeNode {
  const root: LibraryTreeNode = { key: "", name: "", path: [], children: [], files: [], total: 0, videos: 0 };
  const index = new Map<string, LibraryTreeNode>([["", root]]);

  for (const item of items) {
    const path = treePathFor(item, view);
    let parent = root;
    for (let depth = 0; depth < path.length; depth++) {
      const sub = path.slice(0, depth + 1);
      const key = nodeKey(sub);
      let node = index.get(key);
      if (!node) {
        node = { key, name: path[depth], path: sub, children: [], files: [], total: 0, videos: 0 };
        index.set(key, node);
        parent.children.push(node);
      }
      parent = node;
    }
    parent.files.push(item);
  }

  const subjectOrder = [...KNOWN_SUBJECTS.map((s) => s.name), UNCLASSIFIED_LABEL];
  function finalize(node: LibraryTreeNode) {
    node.files.sort((a, b) => naturalCompare(fileName(a), fileName(b)));
    if (node === root && view === "area") {
      node.children.sort((a, b) => subjectOrder.indexOf(a.name) - subjectOrder.indexOf(b.name));
    } else {
      node.children.sort((a, b) => naturalCompare(a.name, b.name));
    }
    node.total = node.files.length;
    node.videos = node.files.filter((f) => fileKind(f) === "video").length;
    for (const child of node.children) {
      finalize(child);
      node.total += child.total;
      node.videos += child.videos;
    }
  }
  finalize(root);
  return root;
}

export function findTreeNode(root: LibraryTreeNode, path: string[]): LibraryTreeNode | undefined {
  let node: LibraryTreeNode | undefined = root;
  for (const segment of path) {
    node = node.children.find((c) => c.name === segment);
    if (!node) return undefined;
  }
  return node;
}

/** Todos os arquivos de uma pasta e subpastas, na ordem de leitura da árvore. */
export function collectTreeFiles(node: LibraryTreeNode): ClassifiedFile[] {
  const out: ClassifiedFile[] = [...node.files];
  for (const child of node.children) out.push(...collectTreeFiles(child));
  return out;
}

export interface NodeProgress {
  done: number;
  started: number;
}

/** Progresso agregado de cada pasta (chave = nodeKey), numa única passada. */
export function computeTreeProgress(root: LibraryTreeNode, userStates: Record<string, ContentProgress>): Map<string, NodeProgress> {
  const map = new Map<string, NodeProgress>();
  function walk(node: LibraryTreeNode): NodeProgress {
    const acc: NodeProgress = { done: 0, started: 0 };
    for (const f of node.files) {
      const state = userStates[f.id];
      if (isFileComplete(f, state)) acc.done++;
      else if (isFileStarted(f, state)) acc.started++;
    }
    for (const child of node.children) {
      const p = walk(child);
      acc.done += p.done;
      acc.started += p.started;
    }
    map.set(node.key, acc);
    return acc;
  }
  walk(root);
  return map;
}

/** "Comece por aqui": continua o último item aberto e não concluído desta
 * pasta; senão, o primeiro vídeo ainda não concluído (ou qualquer arquivo). */
export function pickStartHere(
  node: LibraryTreeNode,
  userStates: Record<string, ContentProgress>
): { file: ClassifiedFile; reason: "continuar" | "proximo" } | undefined {
  const files = collectTreeFiles(node);
  let recent: ClassifiedFile | undefined;
  let recentAt = "";
  for (const f of files) {
    const state = userStates[f.id];
    if (state?.lastViewedAt && !isFileComplete(f, state) && state.lastViewedAt > recentAt) {
      recent = f;
      recentAt = state.lastViewedAt;
    }
  }
  if (recent) return { file: recent, reason: "continuar" };
  const next =
    files.find((f) => fileKind(f) === "video" && !isFileComplete(f, userStates[f.id])) ??
    files.find((f) => !isFileComplete(f, userStates[f.id]));
  return next ? { file: next, reason: "proximo" } : undefined;
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
