ALTER TABLE "User" ADD COLUMN "pendingEmail" TEXT, ADD COLUMN "emailChangeHash" TEXT, ADD COLUMN "emailChangeExpiresAt" TIMESTAMP(3), ADD COLUMN "emailChangeAttempts" INTEGER NOT NULL DEFAULT 0;
