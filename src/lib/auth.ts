// ============================================================================
// Configuração do NextAuth (Google OAuth) — server-side.
//
// Escopos pedidos são o mínimo necessário (seção 17 e 24): identificar o
// usuário e ler (somente leitura) os arquivos/pastas do Drive que ele
// escolher. Nunca solicitamos escrita ou acesso a todo o Drive por padrão.
//
// Sem GOOGLE_CLIENT_ID/SECRET configurados, as rotas de auth respondem com
// erro de configuração e o app opera inteiramente em modo demonstração —
// nenhuma tela fica bloqueada por falta de login real.
// ============================================================================

import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { isDriveConfigured } from "./driveClient";

const DRIVE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
].join(" ");

export const authOptions: NextAuthOptions = {
  // Em modo demonstração (sem GOOGLE_CLIENT_ID/SECRET reais) não há sessão
  // real para assinar, mas o NextAuth ainda exige um `secret` para não
  // falhar em produção. Este valor de fallback nunca protege dados reais —
  // assim que GOOGLE_CLIENT_ID/SECRET forem configurados, defina também
  // NEXTAUTH_SECRET (ver .env.example) para substituí-lo.
  secret: process.env.NEXTAUTH_SECRET || "medstudy-hub-demo-mode-insecure-secret",
  providers: isDriveConfigured()
    ? [
        GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID as string,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
          authorization: {
            params: {
              scope: DRIVE_SCOPES,
              access_type: "offline",
              prompt: "consent",
            },
          },
        }),
      ]
    : [],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account }) {
      // O access_token do Google fica somente no token JWT assinado
      // (nunca exposto ao client) — usado depois pelas Route Handlers em
      // src/app/api/drive/* para chamar a Drive API em nome do usuário.
      if (account?.access_token) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
      }
      return token;
    },
    async session({ session }) {
      // Propositalmente NÃO copiamos accessToken para `session` — rotas de
      // API leem o token do lado do servidor via getToken(), o client nunca
      // vê a credencial do Google.
      return session;
    },
  },
};
