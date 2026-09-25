import { NextRequest, NextResponse } from "next/server";
import { parseTaxonomyWorkbook } from "@/lib/importTaxonomy";

/**
 * Recebe a planilha (.xlsx) de taxonomia (classificação em lote da
 * Biblioteca), faz o parse e a validação no servidor. Mesma filosofia de
 * src/app/api/import/courses/route.ts — não grava nada, só devolve o
 * preview para o cliente gravar em classificationStore (localStorage) após
 * a confirmação.
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
    const result = await parseTaxonomyWorkbook(buffer, file.name);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Não foi possível ler a planilha.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
