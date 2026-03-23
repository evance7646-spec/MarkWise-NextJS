/*
  Warnings:

  - Added the required column `updatedAt` to the `Group` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "attachments" JSONB,
ADD COLUMN     "maxScore" INTEGER,
ADD COLUMN     "rubric" JSONB,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'individual';

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "capacity" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "unitId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "feedback" TEXT,
ADD COLUMN     "grade" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "lecturerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'file',
    "fileUrl" TEXT,
    "linkUrl" TEXT,
    "textContent" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Material_unitId_idx" ON "Material"("unitId");

-- CreateIndex
CREATE INDEX "Group_unitId_idx" ON "Group"("unitId");

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
