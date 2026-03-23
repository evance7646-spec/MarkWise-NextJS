-- CreateTable
CREATE TABLE "DepartmentUnit" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,

    CONSTRAINT "DepartmentUnit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DepartmentUnit_departmentId_idx" ON "DepartmentUnit"("departmentId");

-- CreateIndex
CREATE INDEX "DepartmentUnit_unitId_idx" ON "DepartmentUnit"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentUnit_departmentId_unitId_key" ON "DepartmentUnit"("departmentId", "unitId");

-- AddForeignKey
ALTER TABLE "DepartmentUnit" ADD CONSTRAINT "DepartmentUnit_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentUnit" ADD CONSTRAINT "DepartmentUnit_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
