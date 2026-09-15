# MedStudy Hub

Biblioteca de estudos para estudantes de Medicina, construída a partir de uma pasta do Google Drive. Encontra videoaulas e apostilas automaticamente, organiza por disciplina, e acompanha seu progresso (aulas assistidas, materiais estudados, favoritos).

## Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Next.js Route Handlers (`src/app/api/**`)
- **Autenticação**: NextAuth (Google OAuth), escopo somente leitura do Drive
- **Integração**: `googleapis` (Google Drive API v3)
- **Banco de dados**: PostgreSQL via Prisma (`prisma/schema.prisma`)
- **Estado do usuário (demo)**: Zustand com persistência em `localStorage`

## Rodando localmente

```bash
npm install
npm run dev
```

Abra http://localhost:3000 — sem nenhuma variável de ambiente configurada, a aplicação inicia automaticamente em **modo demonstração**, usando os dados fictícios de `src/lib/mockData.ts` (disciplinas, videoaulas e apostilas de exemplo). Todo o fluxo — onboarding, dashboard, disciplinas, player, progresso, favoritos, busca — funciona de ponta a ponta nesse modo, com o estado do usuário salvo no navegador.

## Conectando um Google Drive real

1. Copie `.env.example` para `.env.local`.
2. Crie credenciais OAuth em https://console.cloud.google.com/apis/credentials (tipo "Web application"), com o callback `http://localhost:3000/api/auth/callback/google`, e habilite a Google Drive API no projeto.
3. Preencha `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET` (gere com `openssl rand -base64 32`) e `DATABASE_URL` (Postgres).
4. Rode `npx prisma migrate dev` para criar as tabelas.
5. Reinicie o servidor — a aplicação detecta as credenciais automaticamente (`isDriveConfigured()` em `src/lib/driveClient.ts`) e passa a usar o Drive real em vez dos dados de demonstração.

Pontos de integração já preparados, mas que exigem essas credenciais para funcionar de fato:

- `src/lib/driveClient.ts` — varredura recursiva do Drive (`fetchRealDriveTree`) e listagem de pastas (`listSubfolders`).
- `src/lib/auth.ts` — configuração do NextAuth com os escopos mínimos (`drive.readonly`, `drive.metadata.readonly`).
- `src/app/api/drive/*` — rotas que conectam o client à Drive API.
- `prisma/schema.prisma` — modelos `DriveFile` (espelha o Drive) e `UserFileState` (progresso do usuário, nunca perdido em uma nova sincronização).

## Estrutura de organização automática

`src/lib/classify.ts` interpreta o nome dos arquivos e o caminho de pastas para inferir disciplina, número da aula e tema (ex.: `"Cardio - Aula 03 - Insuficiência Cardíaca.mp4"` → disciplina Cardiologia, Aula 3, tema "Insuficiência Cardíaca"). Arquivos que não puderem ser classificados com confiança são marcados com `needsReview: true`.

## Scripts

- `npm run dev` — servidor de desenvolvimento
- `npm run build` — build de produção
- `npm run start` — serve o build de produção
- `npm run lint` — ESLint
- `npm run typecheck` — checagem de tipos TypeScript

## Aviso

Os dados de demonstração (nomes de aulas, disciplinas, apostilas) são fictícios e não constituem conteúdo médico oficial.
