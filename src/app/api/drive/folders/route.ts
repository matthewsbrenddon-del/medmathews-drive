import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { isDriveConfigured, listSubfolders } from "@/lib/driveClient";

/**
 * Lista subpastas do Drive do usuário autenticado — alimenta o FolderPicker
 * no onboarding (seção 5). Exige sessão válida; sem GOOGLE_CLIENT_ID/SECRET
 * configurados, retorna 501 e o client cai para o seletor de pastas
 * demonstrativo.
 */
export async function GET(req: NextRequest) {
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

  const parentId = req.nextUrl.searchParams.get("parentId") ?? "root";
  const folders = await listSubfolders(token.accessToken as string, parentId);
  return NextResponse.json({ folders });
}
