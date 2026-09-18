import { NextRequest, NextResponse } from "next/server";
import { parseQuestionsWorkbook } from "@/lib/importQuestions";

/**
 * Recebe a planilha (.xlsx) do banco de questões, faz o parse e a validação
 * no servidor. Mesma filosofia de src/app/api/import/courses/route.ts — não
 * grava em banco, apenas devolve o preview para confirmação no client.
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
    const result = await parseQuestionsWorkbook(buffer, file.name);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Não foi possível ler a planilha.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
