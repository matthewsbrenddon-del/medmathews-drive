import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { classifyContent } from "@/lib/classify";
import { fetchRealDriveTree, isDriveConfigured } from "@/lib/driveClient";

/**
 * Sincroniza a pasta escolhida pelo usuário (seção 15):
 *  1. varre o Drive recursivamente (fetchRealDriveTree);
 *  2. classifica cada arquivo (classifyContent);
 *  3. faz upsert em DriveFile por `fileId` (nunca por nome) — em produção,
 *     isso seria feito via Prisma (ver prisma/schema.prisma), preservando
 *     todo UserFileState já existente.
 *
 * Sem credenciais reais configuradas, retorna 501 — o client usa os dados
 * de demonstração (src/lib/mockData.ts) e não chama esta rota.
 */
export async function POST(req: NextRequest) {
  if (!isDriveConfigured()) {
    return NextResponse.json(
      { error: "Google Drive não configurado neste ambiente. Veja .env.example." },
      { status: 501 }
    );
  }

  const token = await getToken({ req });
  if (!token?.accessToken) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { rootFolderId } = (await req.json()) as { rootFolderId?: string };
  if (!rootFolderId) {
    return NextResponse.json({ error: "rootFolderId é obrigatório." }, { status: 400 });
  }

  const files = await fetchRealDriveTree(token.accessToken as string, rootFolderId);
  const content = files.map((file) => ({ ...file, ...classifyContent(file) }));

  // TODO(produção): persistir `content` via Prisma (upsert por fileId) e
  // remover da base os fileIds que não apareceram mais nesta sincronização,
  // preservando a tabela UserFileState intacta.

  return NextResponse.json({
    totalVideos: content.filter((c) => c.kind === "videoaula").length,
    totalMaterials: content.filter((c) => c.kind !== "videoaula").length,
    needsReview: content.filter((c) => c.needsReview).length,
    content,
  });
}
