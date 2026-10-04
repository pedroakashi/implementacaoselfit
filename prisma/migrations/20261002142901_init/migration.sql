-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('not_contacted', 'queued', 'sent', 'delivered', 'read', 'failed');

-- CreateEnum
CREATE TYPE "CandidateSource" AS ENUM ('manual', 'csv', 'gupy_api', 'gupy_webhook');

-- CreateTable
CREATE TABLE "Vaga" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "openings" INTEGER NOT NULL,
    "gupyJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vaga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "vagaId" TEXT NOT NULL,
    "gupyApplicationId" TEXT,
    "source" "CandidateSource" NOT NULL DEFAULT 'manual',
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "hasPhone" BOOLEAN NOT NULL DEFAULT true,
    "city" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'Triagem',
    "contactStatus" "ContactStatus" NOT NULL DEFAULT 'not_contacted',
    "messageId" TEXT,
    "statusAt" TIMESTAMP(3),
    "gupyUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageRecord" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "status" "ContactStatus" NOT NULL DEFAULT 'sent',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GupyEvent" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "applicationId" TEXT,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GupyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vaga_gupyJobId_key" ON "Vaga"("gupyJobId");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_gupyApplicationId_key" ON "Candidate"("gupyApplicationId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageRecord_messageId_key" ON "MessageRecord"("messageId");

-- CreateIndex
CREATE INDEX "GupyEvent_applicationId_idx" ON "GupyEvent"("applicationId");

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_vagaId_fkey" FOREIGN KEY ("vagaId") REFERENCES "Vaga"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageRecord" ADD CONSTRAINT "MessageRecord_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
