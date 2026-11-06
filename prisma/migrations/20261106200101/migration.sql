/*
  Warnings:

  - You are about to drop the column `player2Id` on the `PairOfPlayers` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PairOfPlayers" DROP COLUMN "player2Id",
ALTER COLUMN "player1Id" DROP NOT NULL;
