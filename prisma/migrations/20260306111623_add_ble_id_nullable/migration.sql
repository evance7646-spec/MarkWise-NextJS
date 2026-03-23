/*
  Warnings:

  - A unique constraint covering the columns `[bleId]` on the table `Room` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[bleId]` on the table `Unit` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "bleId" INTEGER;

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "bleId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Room_bleId_key" ON "Room"("bleId");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_bleId_key" ON "Unit"("bleId");
