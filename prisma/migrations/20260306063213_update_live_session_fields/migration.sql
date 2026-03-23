/*
  Warnings:

  - You are about to drop the column `course` on the `LiveSession` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `LiveSession` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `LiveSession` table. All the data in the column will be lost.
  - Added the required column `unit_id` to the `LiveSession` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "LiveSession" DROP COLUMN "course",
DROP COLUMN "description",
DROP COLUMN "name",
ADD COLUMN     "unit_id" TEXT NOT NULL;
