-- CreateEnum
CREATE TYPE "ContentKind" AS ENUM ('VIDEOAULA', 'APOSTILA', 'OUTRO');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('CONTEUDO', 'QUESTAO');

-- CreateEnum
CREATE TYPE "WatchStatus" AS ENUM ('NAO_INICIADA', 'EM_ANDAMENTO', 'ASSISTIDA');

-- CreateEnum
CREATE TYPE "ReadStatus" AS ENUM ('NAO_ACESSADO', 'ACESSADO', 'ESTUDADO');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('NAO_RESPONDIDA', 'ACERTADA', 'ERRADA');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserState" (
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "modifiedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserState_pkey" PRIMARY KEY ("userId","key")
);

-- CreateTable
CREATE TABLE "AuthAttempt" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Content" (
    "id" TEXT NOT NULL,
    "driveFileId" TEXT NOT NULL,
    "driveLink" TEXT NOT NULL,
    "disciplina" TEXT NOT NULL,
    "subjectSlug" TEXT NOT NULL,
    "modulo" TEXT,
    "lessonNumber" INTEGER,
    "titulo" TEXT NOT NULL,
    "tema" TEXT,
    "kind" "ContentKind" NOT NULL,
    "durationMin" INTEGER,
    "ordem" INTEGER,
    "prioridade" INTEGER NOT NULL DEFAULT 3,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "disciplina" TEXT NOT NULL,
    "subjectSlug" TEXT NOT NULL,
    "tema" TEXT,
    "banca" TEXT,
    "ano" INTEGER,
    "enunciado" TEXT NOT NULL,
    "alternativaA" TEXT NOT NULL,
    "alternativaB" TEXT NOT NULL,
    "alternativaC" TEXT NOT NULL,
    "alternativaD" TEXT NOT NULL,
    "alternativaE" TEXT,
    "gabarito" TEXT NOT NULL,
    "comentario" TEXT,
    "dificuldade" INTEGER NOT NULL DEFAULT 3,
    "tags" TEXT[],
    "observacoes" TEXT,
    "hasImage" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemType" "ItemType" NOT NULL,
    "contentId" TEXT,
    "questionId" TEXT,
    "watchStatus" "WatchStatus",
    "readStatus" "ReadStatus",
    "questionStatus" "QuestionStatus",
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "playbackPositionSeconds" INTEGER,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "lastViewedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "correctStreak" INTEGER NOT NULL DEFAULT 0,
    "answerHistory" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "AuthAttempt_key_createdAt_idx" ON "AuthAttempt"("key", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Content_driveFileId_key" ON "Content"("driveFileId");

-- CreateIndex
CREATE INDEX "Content_subjectSlug_idx" ON "Content"("subjectSlug");

-- CreateIndex
CREATE INDEX "Content_kind_idx" ON "Content"("kind");

-- CreateIndex
CREATE INDEX "Question_subjectSlug_idx" ON "Question"("subjectSlug");

-- CreateIndex
CREATE INDEX "Question_banca_idx" ON "Question"("banca");

-- CreateIndex
CREATE INDEX "Question_ano_idx" ON "Question"("ano");

-- CreateIndex
CREATE INDEX "UserProgress_userId_idx" ON "UserProgress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProgress_userId_contentId_key" ON "UserProgress"("userId", "contentId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProgress_userId_questionId_key" ON "UserProgress"("userId", "questionId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserState" ADD CONSTRAINT "UserState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProgress" ADD CONSTRAINT "UserProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProgress" ADD CONSTRAINT "UserProgress_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProgress" ADD CONSTRAINT "UserProgress_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
