/*
  Warnings:

  - You are about to drop the column `checksum` on the `InstitutionMappingSet` table. All the data in the column will be lost.
  - You are about to drop the column `normalizedRoom` on the `InstitutionMappingSet` table. All the data in the column will be lost.
  - You are about to drop the column `normalizedUnit` on the `InstitutionMappingSet` table. All the data in the column will be lost.
  - You are about to drop the column `reverseRoom` on the `InstitutionMappingSet` table. All the data in the column will be lost.
  - You are about to drop the column `reverseUnit` on the `InstitutionMappingSet` table. All the data in the column will be lost.
  - You are about to drop the column `roomMappings` on the `InstitutionMappingSet` table. All the data in the column will be lost.
  - You are about to drop the column `unitMappings` on the `InstitutionMappingSet` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[institutionId,version,mappingKey]` on the table `InstitutionMappingSet` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `mappingKey` to the `InstitutionMappingSet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `roomId` to the `InstitutionMappingSet` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "InstitutionMappingSet_institutionId_version_key";

-- AlterTable
ALTER TABLE "InstitutionMappingSet" DROP COLUMN "checksum",
DROP COLUMN "normalizedRoom",
DROP COLUMN "normalizedUnit",
DROP COLUMN "reverseRoom",
DROP COLUMN "reverseUnit",
DROP COLUMN "roomMappings",
DROP COLUMN "unitMappings",
ADD COLUMN     "mappingKey" TEXT NOT NULL,
ADD COLUMN     "roomId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionMappingSet_institutionId_version_mappingKey_key" ON "InstitutionMappingSet"("institutionId", "version", "mappingKey");

-- AddForeignKey
ALTER TABLE "InstitutionMappingSet" ADD CONSTRAINT "InstitutionMappingSet_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
