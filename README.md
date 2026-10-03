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

## Cronograma personalizável

Em **Cronograma**, monte o plano em 4 passos: **período** (início e fim — prova, rodízio, bloco de revisão), **disponibilidade** (minutos de cada dia da semana + folgas em datas específicas), **conteúdo** (grandes áreas com prioridade baixa/média/alta e os temas exatos de cada uma, ordenados pelos mais cobrados no banco de questões) e **estratégia** (cursos, "um curso por tema", tipos de material, mistura aulas/questões/revisão, áreas intercaladas ou uma por vez, revisão espaçada D+1/D+7/D+30). Um resumo ao vivo mostra quanto do conteúdo cabe no período. O plano (`src/lib/cronograma.ts`) usa as aulas reais do acervo (temas de `library-mapeamento.json`) e as questões do banco, e é sempre recalculado a partir do progresso atual — ao concluir uma aula, os próximos dias se reorganizam sozinhos.

## Disciplinas — uma biblioteca, duas navegações

**Disciplinas** é a biblioteca completa do acervo real (cursinhos, e-books, bancos de questões em PDF — hoje ~13,6 mil arquivos em `public/seed-data/library-mapeamento.json`, gerado a partir de `seed-data/MedStudyHub_Mapeamento_Materiais.xlsx`), navegável de três formas sobre o **mesmo** conteúdo — nunca listas separadas:

- **Por Grande Área** (padrão): Grande Área ENAMED → Disciplina → arquivo, usando a classificação clínica (`src/lib/classification.ts`). Itens sem classificação confiável ficam agrupados em "A classificar" (por curso de origem), nunca escondidos.
- **Por Tema**: Grande Área → Tema → Subtema → arquivo, juntando o mesmo assunto de todos os cursinhos (ex.: "Insuficiência Cardíaca" reúne as aulas da EstratégiaMED, os podcasts/pílulas da MedCel, as videoaulas do Medcurso e da Sanar).
- **Por Curso**: exatamente a estrutura de pastas original de cada provedor (MedCel, EstratégiaMED, MedCurso, Sanar...) — cada um organiza diferente, e essa visão preserva esse contexto.

Ambas abrem o mesmo `FilePreviewModal` (preview do Drive embutido num iframe, sem redirecionar para fora da plataforma) e escrevem no mesmo `useStudyStore` (favorito/assistido/estudado, chaveado pelo ID do arquivo do Drive) — abrir um item por qualquer uma das visões nunca duplica progresso.

**Títulos, temas e subtemas** (`scripts/build-library-topics.py`): muitos arquivos têm nome genérico ("1. Aula.mp4", "Podcast.mp3", "309990.mp4", "MAT322583_IDAPOST…pdf") — o assunto está na pasta que os contém. O script lê o contexto de pasta de cada arquivo e grava em `library-mapeamento.json` um `titulo` legível ("Choque — Podcast", "Insuficiência Cardíaca (Parte 1) — Aula 2"), o `tipo` (Videoaula, Slide, Resumo, Apostila, Podcast, Pílula, Capítulo de livro, Resolução de questão…), o `tema` canônico (dicionário curado a partir da leitura dos ~1.500 nomes de pasta, para o mesmo assunto casar entre cursos) e o `subtema`. Rode `python3 scripts/build-library-topics.py --report` depois de atualizar a planilha. A busca de Videoaulas, Materiais e Disciplinas considera título, tema e subtema.

**Classificação dos itens:**
- `src/lib/classification.ts#autoClassify` tenta inferir a grande área a partir do caminho original (área da planilha → subpastas → nome do curso) contra os aliases de `src/lib/subjects.ts#matchKnownSubject` — só classifica quando há correspondência confiável (nunca força uma área errada).
- Itens sem correspondência ficam "a classificar": **Disciplinas → banner "N itens aguardando classificação" → /disciplinas/classificar**, onde dá para selecionar vários de uma vez e atribuir Grande Área/Disciplina em lote (com sugestão individual opcional baseada no nome do arquivo).
- Ou em lote via planilha: **Configurações → Importar planilha de taxonomia** — `.xlsx` com colunas `ID do Arquivo (Drive)` (ou `Curso` + `Conteúdo`), `Grande Área`, `Disciplina`, `Subtema` (ver `seed-data/MedStudyHub_Taxonomia_Curso_Drive.xlsx`, quando disponível).
- Classificações manuais/importadas ficam em `classificationStore` (localStorage, só os overrides — a sugestão automática nunca é persistida, é recalculada na hora).

O cronograma agenda só os temas que o aluno escolhe (nunca o acervo inteiro). `src/lib/libraryStore.ts` busca o JSON uma única vez por sessão, sem persistir em `localStorage` (grande demais e é referência estática).

## IA para quizzes, flashcards e cronograma (opcional)

Três recursos adicionais — nunca substitutivos — usam a API da Claude quando `ANTHROPIC_API_KEY` está configurada (veja `.env.example`); sem a chave, os três ficam indisponíveis com uma mensagem clara na interface e o resto da plataforma continua funcionando normalmente:

- **Quizzes** (`/quizzes`, `/api/ai/quiz`, modelo Claude Sonnet): gera questões de múltipla escolha em tempo real a partir de um tema/instrução e, opcionalmente, um material de referência colado (texto). Cada questão gerada passa por uma tela de revisão (editar enunciado/alternativas/gabarito/comentário, aprovar ou descartar) antes de entrar no Banco de Questões, marcada com `origem: "ia"`.
- **Gerar flashcards com IA** (`/api/ai/flashcards`, modelo Claude Haiku, em **Flashcards**): dois modos — a partir de questões do banco selecionadas como material de origem, ou a partir de um tema livre + material de referência colado. Os cartões passam por uma tela de revisão (editar/descartar/aprovar em lote) antes de serem salvos no deck.
- **Otimizar 14 dias com IA** (`/api/ai/cronograma`, em **Cronograma**): reorganiza os itens dos próximos 14 dias do plano determinístico (`src/lib/cronograma.ts`), levando em conta o desempenho por tema no banco de questões, e acrescenta uma justificativa curta para os itens de alta prioridade. Só roda quando o usuário clica no botão — nunca automaticamente, para controlar custo. O algoritmo determinístico continua sendo o padrão/fallback.

A chave nunca é exposta no navegador — toda chamada à API da Claude acontece em `src/app/api/ai/*` (server-side), via `src/lib/ai/anthropicClient.ts`.

## Caderno (bloco de notas)

**Caderno** (`/caderno`) é um bloco de notas livre do próprio aluno — vários cadernos, markdown leve (títulos, **negrito**, *itálico*, `==grifo==`, listas, checklists, citações), barra de formatação, visão lado a lado e salvamento automático (~1,2 s após parar de digitar, com indicador "Salvando…/Salvo"). O botão **Anotar** no player de aulas/materiais e na tela de questões abre um painel lateral com o último caderno usado, anexando uma referência clicável de volta à origem (`via Questão 12 — Cardiologia`), que o aluno pode remover. Cada caderno é um texto único (`src/lib/cadernoStore.ts`); a referência é só um link markdown `origem:<tipo>:<id>` dentro do texto (`src/lib/markdown.tsx`, renderizado sem HTML cru).

As antigas coleções de questões chamadas "Cadernos" agora se chamam **Minhas Listas** (`/listas`).

## Tela de questões

`/questoes` mostra "Encontramos X questões", abas **Todas / Não resolvidas / Resolvidas / Acertei / Errei / Marcadas** (pelo histórico do próprio aluno), "Excluir anuladas", ordenação (recentes, grande área, dificuldade, nunca respondidas primeiro), chips removíveis dos filtros aplicados, **filtros salvos** com nome e **⚡ simulado relâmpago** (20 questões sorteadas de um filtro, com ordem fixa por `seed` na URL). O campo "desatualizada" não existe na planilha de questões atual, por isso não há filtro para ele.

Resolvendo (`/questoes/estudo`, `src/components/QuestionBattery.tsx`): cabeçalho "Questão 3 de 47" com breadcrumb banca/ano › grande área › tema › subtema, alternativas em círculos com estados de certo/errado e tesoura para eliminar alternativas, aviso quando a questão tem imagem ainda não extraída, e a linha de ações **Gabarito comentado** (ponto de "não lido"), **Minhas anotações** (trechos do Caderno ligados à questão), **Estatísticas** (histórico do aluno) e **Aulas relacionadas** (até 3 videoaulas do acervo que casam com a grande área e o tema). Barra flutuante: modo foco, desempenho da sessão, cronômetro (sessão e questão), tamanho do texto e preferências (revelar gabarito ao clicar, avançar automaticamente). Atalhos: **A–E/1–5** escolhe, **Enter** responde, **→/Espaço** próxima, **←** anterior, **?** ajuda. Ao voltar para a mesma lista, oferece "Continuar de onde parei".

## Acesso às videoaulas

Todas as entradas — Disciplinas (as duas visões), Videoaulas, Apostilas e Materiais, Dashboard, Busca, Favoritos e Aulas relacionadas — abrem o mesmo player (`FilePreviewModal`) com o embed `https://drive.google.com/file/d/{ID}/preview` do acervo real, com Anterior/Próxima na mesma pasta. Para o vídeo tocar, cada arquivo precisa estar compartilhado no Drive como "Qualquer pessoa com o link". Disciplinas tem árvore expansível com progresso por nível e o card **Comece por aqui / Continue de onde parou**, e lembra a pasta aberta entre visitas.

## Práticas: Quizzes, Simulado, Listas, grifo e exportação em PDF

A área de prática (Questões, Quizzes, Flashcards, Simulado e Minhas Listas, agrupados sob "Prática" na barra lateral) compartilha um único motor de bateria de questões (`src/components/QuestionBattery.tsx`), usado tanto no Banco de Questões (`/questoes/estudo`) quanto nas Listas pessoais (`/listas/[id]`):

- **Grifo de texto**: selecione qualquer trecho do enunciado ou de uma alternativa com o mouse para marcá-lo em uma de 4 cores fixas (amarelo/rosa/verde/ciano), legíveis tanto no tema claro quanto no escuro. Os grifos são persistidos por questão em `src/lib/highlightStore.ts`, indexados por offset de texto (não pela posição no DOM), então sobrevivem a re-renderizações.
- **Foco**: botão flutuante que alterna entre o feed contínuo (todas as questões da bateria, rolável) e um modo carrossel (uma questão por vez, com Anterior/Próxima).
- **Por questão**: favoritar (★), adicionar a uma ou mais **Listas** pessoais (`src/lib/notebookStore.ts` — coleções nomeadas de questões, sem depender de disciplina/tema) e minimizar (colapsa para uma linha).
- **Exportação em PDF** (`src/lib/pdfExport.ts`, via `jspdf`): exporta a bateria filtrada atual em um PDF formatado, com marca d'água da plataforma em todas as páginas, nome do aluno (definido em **Configurações → Seu nome**) e data na capa, e gabarito comentado ao final. Limitada a 100 questões por exportação — para exportar o restante, informe "a partir da questão" no topo da bateria (ou navegue até lá em modo Foco) e exporte novamente a partir dali.
- **Cronômetro de sessão** (`src/lib/useStudyTimer.ts` + `src/lib/studySessionStore.ts`): mede automaticamente o tempo líquido gasto em cada sessão de Questões/Simulado/Flashcards (sessões residuais de menos de 3s não contam) e alimenta o painel **Horas líquidas de estudo** em **Meu Progresso**, filtrável por 24h/7 dias/mensal/anual/período selecionável, com detalhamento por tipo de sessão.

## Modo foco (Pomodoro, cronômetro e timer)

Um botão flutuante em todas as telas abre o timer de estudo: **Pomodoro** (foco/pausa/pausa longa configuráveis, auto-iniciar, som e notificação), **cronômetro** e **timer** com contagem regressiva. Pode ser usado avulso ou vinculado ao que está aberto — o player de aula e a tela de questões têm um controle compacto que inicia o timer já com o nome da aula/sessão. O estado é salvo com horários reais (`src/lib/focusTimerStore.ts`), então continua certo ao trocar de tela ou recarregar. Cada trecho de foco vira uma sessão em Meu Progresso (horas líquidas somam a **união** dos intervalos, sem contar em dobro um Pomodoro feito durante uma sessão de questões) e aparece na Agenda. Em `/foco` há a versão em tela cheia com os últimos 7 dias.

## Agenda (Google Agenda, tarefas, Kanban)

Em **Agenda**: visões **Mês, Semana, Dia, To-do e Kanban** sobre as mesmas fontes, com sincronização a cada minuto e sempre que a aba volta ao foco:

- **Conta Google** (leitura e escrita): o aluno conecta a própria conta pelo Google Identity Services no navegador — eventos de todas as agendas marcadas, criação/exclusão de eventos e as tarefas do **Google Tasks** (concluir/reabrir e criar). Precisa de um ID do cliente OAuth (`NEXT_PUBLIC_GOOGLE_CLIENT_ID` ou colado na própria Agenda); o token fica só na aba (`sessionStorage`) e nunca passa pelo servidor.
- **Link iCal secreto** (somente leitura, sem configurar nada): `/api/calendar/ics` busca e expande o `.ics` (inclusive eventos recorrentes e exceções, via `ical.js`). Só aceita endereços `calendar.google.com/calendar/ical/…`.
- **Eventos e tarefas locais** (prioridade, etiqueta, prazo com horário), o **Cronograma** de estudos e as **sessões de estudo** como camadas.

O Kanban tem as colunas A fazer / Fazendo / Concluído (arrastar e soltar); para tarefas do Google, "Fazendo" é guardado localmente, já que o Google Tasks só tem pendente/concluída.

## Contas e acesso em vários dispositivos

Com `DATABASE_URL` (Postgres) configurado, a plataforma exige login por **e-mail e senha** (`/entrar`) e sincroniza todos os dados do aluno — progresso, questões, cadernos, listas, grifos, flashcards, quizzes, cronograma, agenda, sessões de estudo e preferências — entre os dispositivos:

- **Segurança**: senha com scrypt (sal por usuário, comparação em tempo constante, mesmo tempo de resposta para e-mail inexistente); sessão por cookie `httpOnly` + `Secure` + `SameSite=Lax` com token aleatório de 256 bits, guardado no banco só como SHA-256; validade de 30 dias renovada com o uso; escritas exigem `Origin` do próprio site; limite de tentativas (5 senhas erradas por e-mail e 20 por IP a cada 15 min); cabeçalhos de segurança (HSTS, `X-Frame-Options`, `nosniff`…). As rotas de IA, importação e iCal também passam a exigir login.
- **Dispositivos**: em Configurações → Conta e dispositivos dá para ver onde a conta está conectada, desconectar um aparelho, sair de todos e trocar a senha (desconecta os outros). Ao sair, os dados são apagados daquele navegador.
- **Sincronização** (`src/lib/sync/syncEngine.ts` + `/api/sync`): cada store salvo no navegador vira um bloco por usuário no banco; alterações sobem em ~1,5 s, e as de outros aparelhos chegam a cada 30 s e ao voltar para a aba, sem recarregar. Em conflito, vence a alteração mais recente daquele bloco. Ao criar a conta, o que já foi estudado naquele navegador vai junto.

**Deploy:** crie um Postgres (na Vercel: Storage → Postgres/Neon, que já preenche `DATABASE_URL`), faça o deploy — o script `vercel-build` gera o Prisma Client e aplica as migrações (`prisma/migrations`). Localmente: `DATABASE_URL=... npx prisma migrate deploy`.

**Ainda não incluso:** recuperação de senha por e-mail (exige um serviço de envio de e-mails) e login com Google.

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
