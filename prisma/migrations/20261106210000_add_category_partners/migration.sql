ALTER TABLE "PairOfPlayers"
ADD COLUMN "registrationId" TEXT,
ADD COLUMN "categoryId" VARCHAR(30);

CREATE UNIQUE INDEX "PairOfPlayers_registrationId_categoryId_key"
ON "PairOfPlayers"("registrationId", "categoryId");

ALTER TABLE "PairOfPlayers"
ADD CONSTRAINT "PairOfPlayers_registrationId_fkey"
FOREIGN KEY ("registrationId") REFERENCES "Registration"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
