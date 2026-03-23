-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_lecturer_id_fkey" FOREIGN KEY ("lecturer_id") REFERENCES "Lecturer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
