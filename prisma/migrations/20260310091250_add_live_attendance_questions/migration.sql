-- AlterTable
ALTER TABLE "LiveSession" ADD COLUMN     "ended_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "live_attendance" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "admission_no" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "time_window" INTEGER,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_questions" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "options" JSONB,
    "correct_option" INTEGER,
    "time_limit" INTEGER NOT NULL DEFAULT 20,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_answers" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "selected_option" INTEGER NOT NULL,
    "answered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "live_attendance_session_id_idx" ON "live_attendance"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "live_attendance_session_id_student_id_time_window_key" ON "live_attendance"("session_id", "student_id", "time_window");

-- CreateIndex
CREATE INDEX "live_questions_session_id_idx" ON "live_questions"("session_id");

-- CreateIndex
CREATE INDEX "live_answers_question_id_idx" ON "live_answers"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "live_answers_question_id_student_id_key" ON "live_answers"("question_id", "student_id");

-- AddForeignKey
ALTER TABLE "live_attendance" ADD CONSTRAINT "live_attendance_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "LiveSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_questions" ADD CONSTRAINT "live_questions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "LiveSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_answers" ADD CONSTRAINT "live_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "live_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
