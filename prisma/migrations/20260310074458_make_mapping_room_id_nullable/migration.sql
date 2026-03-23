-- DropForeignKey
ALTER TABLE "InstitutionMappingSet" DROP CONSTRAINT "InstitutionMappingSet_roomId_fkey";

-- AlterTable
ALTER TABLE "InstitutionMappingSet" ALTER COLUMN "roomId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "InstitutionMappingSet" ADD CONSTRAINT "InstitutionMappingSet_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
