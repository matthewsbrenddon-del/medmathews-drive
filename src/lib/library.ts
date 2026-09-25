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

import type { LibraryFile } from "./types";
import { drivePreviewUrl, driveViewUrl } from "./driveLink";
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
