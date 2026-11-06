-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING');

-- CreateTable
CREATE TABLE "Registration" (
    "id" TEXT NOT NULL,
    "requestId" UUID NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "fullName" VARCHAR(150) NOT NULL,
    "nickname" VARCHAR(80) NOT NULL,
    "address" VARCHAR(300) NOT NULL,
    "trainingPlace" VARCHAR(150) NOT NULL,
    "birthDate" DATE NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "stages" TEXT[],
    "categories" TEXT[],
    "amountCents" INTEGER NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "emailStatus" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "emailLeaseAt" TIMESTAMP(3),
    "emailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequestBucket_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Registration_requestId_key" ON "Registration"("requestId");

-- CreateIndex
CREATE INDEX "RequestBucket_expiresAt_idx" ON "RequestBucket"("expiresAt");
