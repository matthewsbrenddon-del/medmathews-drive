import { NextRequest, NextResponse } from "next/server";
import { parseCoursesWorkbook } from "@/lib/importCourses";

/**
 * Recebe a planilha (.xlsx) de cursos/cronograma, faz o parse e a validação
 * no servidor, e devolve os itens prontos + erros linha a linha. Não grava
 * nada em banco — a confirmação final e a persistência (localStorage nesta
 * versão de demonstração) acontecem no client, em src/lib/contentStore.ts.
 *
 * TODO(produção): com DATABASE_URL configurado, troque a etapa de
 * confirmação no client por uma chamada a este mesmo endpoint com
 * `?commit=true`, fazendo upsert em Content (Prisma) por `fileId` em vez de
 * apenas devolver o preview.
 */
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json({ error: "Envie um arquivo .xlsx." }, { status: 400 });
  }

  try {
    const buffer = await file.arrayBuffer();
    const result = await parseCoursesWorkbook(buffer, file.name);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Não foi possível ler a planilha.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
