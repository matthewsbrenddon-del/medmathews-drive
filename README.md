# MedStudy Hub

Biblioteca de estudos, banco de questões de residência médica e cronograma adaptativo para estudantes de Medicina — construída a partir de planilhas .xlsx que você importa, sem depender de OAuth com o Google.

## Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Next.js Route Handlers (`src/app/api/**`) — hoje usadas apenas para parse/validação de planilhas, sem gravar em banco
- **Planilhas**: `exceljs` (leitura de .xlsx no servidor)
- **Banco de dados**: schema Postgres pronto via Prisma (`prisma/schema.prisma`), opcional nesta versão
- **Estado (demo)**: Zustand com persistência em `localStorage`

## Rodando localmente

```bash
npm install
npm run dev
```

Abra http://localhost:3000 — sem nenhuma variável de ambiente configurada, a aplicação já funciona por completo. Ela inicia com dados fictícios de exemplo (disciplinas, videoaulas, apostilas e questões) e todo o fluxo — dashboard, disciplinas, videoaulas, apostilas, banco de questões, cronograma, progresso, busca, favoritos — funciona de ponta a ponta, com o estado salvo no navegador.

## Como o conteúdo entra na plataforma (sem OAuth)

A v2 não usa login com Google. Em vez disso:

1. Cada aula/material é um arquivo do Google Drive compartilhado como **"Qualquer pessoa com o link pode visualizar"**.
2. Você monta uma planilha `.xlsx` com uma linha por aula/material (colunas: `Disciplina, Módulo, Nº da Aula, Título da Aula/Material, Tema, Tipo, Link do Drive, ID do Arquivo (Drive), Duração (min), Ordem, Prioridade (1-5), Observações`) e importa em **Configurações → Importar planilha de cursos**.
3. O ID do arquivo (chave estável de cada item — nunca o título) é lido da coluna correspondente ou extraído automaticamente do link. Vídeos e PDFs são exibidos com um player embutido via `https://drive.google.com/file/d/{ID}/preview` — sem nenhuma autenticação.
4. Reimportar a planilha faz *upsert* por ID: nunca duplica itens, e o progresso do usuário (assistido/estudado/favorito) é preservado por ID mesmo que títulos mudem.

O banco de questões de residência segue a mesma lógica: planilha `.xlsx` com `Disciplina, Tema, Banca, Ano, Enunciado, Alternativa A–E, Gabarito, Comentário, Dificuldade, Tags, Observações`, importada em **Configurações → Importar banco de questões**.

Veja `src/lib/importCourses.ts` e `src/lib/importQuestions.ts` para as regras de validação (erros são reportados linha a linha, sem travar a importação inteira).

## Cronograma adaptativo

Em **Cronograma**, escolha as disciplinas a priorizar, uma data-alvo e quantos minutos por dia você tem disponíveis. O app distribui as aulas/materiais pendentes (respeitando a `Prioridade` da planilha e a duração de cada item) e blocos de questões pendentes/erradas entre os dias até a data-alvo. O plano é sempre recalculado a partir do progresso atual — nada fica "desatualizado": assim que você conclui algo, ele some do plano automaticamente. Dá para adiar qualquer item para o dia seguinte.

## Banco de dados / produção

Esta versão de demonstração roda inteiramente no navegador (localStorage), então **nenhuma variável de ambiente é necessária** para publicar em um serviço como o Vercel. Se quiser persistir em um banco real:

1. Copie `.env.example` para `.env.local` e preencha `DATABASE_URL` (Postgres).
2. Rode `npx prisma migrate dev` para criar as tabelas descritas em `prisma/schema.prisma` (`Content`, `Question`, `UserProgress` — chaveadas por `driveFileId`/`id`, nunca por título).
3. Troque as stores client-side (`src/lib/contentStore.ts`, `src/lib/questionStore.ts`, `src/lib/store.ts`, `src/lib/questionProgressStore.ts`) por chamadas a rotas que persistem via Prisma — os comentários `TODO(produção)` em `src/app/api/import/*/route.ts` marcam onde plugar isso. A forma dos dados (`StudyContent[]`, `Question[]`) não muda, então nenhuma tela precisa ser reescrita.

## Deploy (Vercel)

1. Crie uma conta em vercel.com e conecte com sua conta do GitHub.
2. "Add New" → "Project" → importe este repositório.
3. Não é necessário configurar nada — clique em "Deploy".
4. Em ~1-2 minutos você recebe uma URL pública (`seu-projeto.vercel.app`) já funcionando em modo demonstração, pronta para importar suas planilhas.

## Integração OAuth completa (não implementada, ponto de extensão documentado)

Uma integração OAuth completa com a Drive API (login com Google + varredura automática de pastas) foi deliberadamente removida desta versão por gerar fricção desnecessária (tela de consentimento, verificação do Google) para uso pessoal/pequeno grupo. Se um dia fizer sentido automatizar a leitura de pastas em vez de depender da planilha:

- Reintroduza NextAuth + `googleapis` (a v1 desta branch, no histórico de commits, já tinha isso funcionando com os escopos mínimos `drive.readonly`/`drive.metadata.readonly`).
- O restante do app não precisa mudar: tanto a importação por planilha quanto uma futura varredura do Drive terminariam produzindo a mesma forma de dado (`StudyContent[]`), consumida pelas mesmas telas.

## Estrutura de resolução de disciplinas

`src/lib/subjects.ts` reconhece nomes/siglas comuns de disciplinas médicas (ex.: "CLM", "Clínica Médica", "clinica medica" → mesma disciplina, com cor/ícone consistentes) e sintetiza automaticamente cor/ícone para qualquer disciplina fora desse catálogo — a plataforma não fica travada em uma lista fixa.

## Scripts

- `npm run dev` — servidor de desenvolvimento
- `npm run build` — build de produção
- `npm run start` — serve o build de produção
- `npm run lint` — ESLint
- `npm run typecheck` — checagem de tipos TypeScript

## Aviso

Os dados de demonstração (nomes de aulas, disciplinas, apostilas, questões) são fictícios/exemplos didáticos e não constituem conteúdo médico oficial nem substituem bancas reais.
