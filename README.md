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

## Disciplinas — uma biblioteca, duas navegações

**Disciplinas** é a biblioteca completa do acervo real (cursinhos, e-books, bancos de questões em PDF — hoje ~13,6 mil arquivos em `public/seed-data/library-mapeamento.json`, gerado a partir de `seed-data/MedStudyHub_Mapeamento_Materiais.xlsx`), navegável de duas formas sobre o **mesmo** conteúdo — nunca duas listas separadas:

- **Por Grande Área** (padrão): Grande Área ENAMED → Disciplina → arquivo, usando a classificação clínica (`src/lib/classification.ts`). Itens sem classificação confiável ficam agrupados em "A classificar" (por curso de origem), nunca escondidos.
- **Por Curso**: exatamente a estrutura de pastas original de cada provedor (MedCel, EstratégiaMED, MedCurso, Sanar...) — cada um organiza diferente, e essa visão preserva esse contexto.

Ambas abrem o mesmo `FilePreviewModal` (preview do Drive embutido num iframe, sem redirecionar para fora da plataforma) e escrevem no mesmo `useStudyStore` (favorito/assistido/estudado, chaveado pelo ID do arquivo do Drive) — abrir um item por qualquer uma das visões nunca duplica progresso.

**Classificação dos itens:**
- `src/lib/classification.ts#autoClassify` tenta inferir a grande área a partir do caminho original (área da planilha → subpastas → nome do curso) contra os aliases de `src/lib/subjects.ts#matchKnownSubject` — só classifica quando há correspondência confiável (nunca força uma área errada).
- Itens sem correspondência ficam "a classificar": **Disciplinas → banner "N itens aguardando classificação" → /disciplinas/classificar**, onde dá para selecionar vários de uma vez e atribuir Grande Área/Disciplina em lote (com sugestão individual opcional baseada no nome do arquivo).
- Ou em lote via planilha: **Configurações → Importar planilha de taxonomia** — `.xlsx` com colunas `ID do Arquivo (Drive)` (ou `Curso` + `Conteúdo`), `Grande Área`, `Disciplina`, `Subtema` (ver `seed-data/MedStudyHub_Taxonomia_Curso_Drive.xlsx`, quando disponível).
- Classificações manuais/importadas ficam em `classificationStore` (localStorage, só os overrides — a sugestão automática nunca é persistida, é recalculada na hora).

O acervo não entra no `contentStore`/`studyPlan`: o cronograma adaptativo continua operando só sobre a grade curada de exemplo — não faria sentido agendar 13,6 mil itens automaticamente. `src/lib/libraryStore.ts` busca o JSON uma única vez por sessão, sem persistir em `localStorage` (grande demais e é referência estática).

## IA para flashcards e cronograma (opcional)

Dois recursos adicionais — nunca substitutivos — usam a API da Claude quando `ANTHROPIC_API_KEY` está configurada (veja `.env.example`); sem a chave, ambos ficam indisponíveis com uma mensagem clara na interface e o resto da plataforma continua funcionando normalmente:

- **Gerar flashcards com IA** (`/api/ai/flashcards`, modelo Claude Haiku): a partir de questões do banco selecionadas como material de origem (a plataforma não extrai texto de PDFs/vídeos do Drive — só temos o ID do arquivo e o link), a IA escreve cartões de recuperação ativa. Os cartões passam por uma tela de revisão (editar/descartar/aprovar em lote) antes de serem salvos no deck.
- **Recalcular com IA** (`/api/ai/cronograma`, modelo Claude Sonnet, em **Cronograma**): reorganiza os mesmos itens pendentes do algoritmo determinístico (`src/lib/studyPlan.ts`), levando em conta o desempenho por tema no banco de questões, e acrescenta uma justificativa curta para os itens de alta prioridade. Só roda quando o usuário clica no botão — nunca automaticamente, para controlar custo. O algoritmo determinístico continua sendo o padrão/fallback.

A chave nunca é exposta no navegador — toda chamada à API da Claude acontece em `src/app/api/ai/*` (server-side), via `src/lib/ai/anthropicClient.ts`.

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
