/*
  Warnings:

  - You are about to drop the column `roomId` on the `InstitutionMappingSet` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "InstitutionMappingSet" DROP CONSTRAINT "InstitutionMappingSet_roomId_fkey";

-- AlterTable
ALTER TABLE "InstitutionMappingSet" DROP COLUMN "roomId";
