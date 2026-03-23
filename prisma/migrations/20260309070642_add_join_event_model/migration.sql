-- CreateTable
CREATE TABLE "JoinEvent" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "admissionNumber" TEXT NOT NULL,
    "meetingLink" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JoinEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JoinEvent_roomId_idx" ON "JoinEvent"("roomId");

-- CreateIndex
CREATE INDEX "JoinEvent_joinedAt_idx" ON "JoinEvent"("joinedAt");
