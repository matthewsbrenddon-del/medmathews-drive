import { NextResponse } from "next/server";
import { isDriveConfigured } from "@/lib/driveClient";

/**
 * Informa ao client se a integração real do Google Drive está configurada
 * neste ambiente (GOOGLE_CLIENT_ID/SECRET presentes) ou se a aplicação deve
 * operar em modo demonstração.
 */
export async function GET() {
  return NextResponse.json({ configured: isDriveConfigured() });
}
