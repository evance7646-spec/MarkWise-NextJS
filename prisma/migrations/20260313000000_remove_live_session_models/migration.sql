-- Drop dependent tables first (foreign keys point to LiveSession)
DROP TABLE IF EXISTS "live_answers";
DROP TABLE IF EXISTS "live_questions";
DROP TABLE IF EXISTS "live_attendance";
DROP TABLE IF EXISTS "QuizSubmission";
DROP TABLE IF EXISTS "Quiz";
DROP TABLE IF EXISTS "LiveSession";
DROP TABLE IF EXISTS "JoinEvent";
