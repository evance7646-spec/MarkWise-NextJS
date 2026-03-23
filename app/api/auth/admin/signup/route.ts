import { NextResponse } from "next/server";
import { adminAuthCorsHeaders, handleAdminSignup } from "@/lib/adminAuthService";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Helper function to find or create department with proper error handling
async function findOrCreateDepartment(institutionId: string, departmentName: string) {
  // Normalize the department name (trim for consistent matching)
  const normalizedName = departmentName.trim();
  
  // Use a transaction to prevent race conditions
  return await prisma.$transaction(async (tx) => {
    // Try to find existing department (case-insensitive)
    let department = await tx.department.findFirst({
      where: {
        name: {
          equals: normalizedName,
          mode: 'insensitive'
        },
        institutionId: institutionId,
      },
    });

    // If not found, create it
    if (!department) {
      try {
        department = await tx.department.create({
          data: {
            name: normalizedName,
            institutionId: institutionId,
          },
        });
      } catch (error: any) {
        // If unique constraint error (P2002), another request created it simultaneously
        if (error.code === 'P2002') {
          department = await tx.department.findFirst({
            where: {
              name: {
                equals: normalizedName,
                mode: 'insensitive'
              },
              institutionId: institutionId,
            },
          });
        } else {
          throw error;
        }
      }
    }

    return department;
  });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  
  try {
    // Handle multipart/form-data (file uploads)
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const data: Record<string, any> = {};
      
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          data[key] = value.name;
        } else {
          data[key] = value;
        }
      }

      // Handle institution admin
      if (data.role === "institution_admin") {
        const institution = await prisma.institution.create({
          data: {
            name: data.institutionName || `${data.fullName} Institution`,
            logoUrl: data.logo || null,
          },
        });
        data.institutionId = institution.id;
      }

      // Handle department admin
      if (data.role === "department_admin") {
        if (!data.institutionId) {
          return NextResponse.json(
            { error: "Institution ID is required for department admin." },
            { status: 400, headers: adminAuthCorsHeaders }
          );
        }

        // Handle department creation/lookup
        if (!data.departmentId && data.departmentName) {
          try {
            const department = await findOrCreateDepartment(data.institutionId, data.departmentName);
            if (department) {
              data.departmentId = department.id;
            } else {
              return NextResponse.json({ error: "Department creation failed." }, { status: 500, headers: adminAuthCorsHeaders });
            }
          } catch (error) {
            console.error("Error creating/finding department:", error);
            return NextResponse.json(
              { error: "Failed to create or find department." },
              { status: 500, headers: adminAuthCorsHeaders }
            );
          }
        }

        if (!data.departmentId) {
          return NextResponse.json(
            { error: "Department ID is required for department admin." },
            { status: 400, headers: adminAuthCorsHeaders }
          );
        }
      }

      // Call the handler with the processed data
      const jsonRequest = {
        ...request,
        json: async () => data,
      } as Request;
      
      return handleAdminSignup(jsonRequest);
    } 
    
    // Handle JSON requests
    else {
      let data: any;
      try {
        data = await request.json();
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON body." },
          { status: 400, headers: adminAuthCorsHeaders }
        );
      }

      // Handle institution admin
      if (data.role === "institution_admin") {
        const institution = await prisma.institution.create({
          data: {
            name: data.institutionName || `${data.fullName} Institution`,
            logoUrl: data.logo || null,
          },
        });
        data.institutionId = institution.id;
      }

      // Handle department admin
      if (data.role === "department_admin") {
        if (!data.institutionId) {
          return NextResponse.json(
            { error: "Institution ID is required for department admin." },
            { status: 400, headers: adminAuthCorsHeaders }
          );
        }

        // Handle department creation/lookup
        if (!data.departmentId && data.departmentName) {
          try {
            const department = await findOrCreateDepartment(data.institutionId, data.departmentName);
            if (department) {
              data.departmentId = department.id;
            } else {
              return NextResponse.json({ error: "Department creation failed." }, { status: 500, headers: adminAuthCorsHeaders });
            }
          } catch (error) {
            console.error("Error creating/finding department:", error);
            return NextResponse.json(
              { error: "Failed to create or find department." },
              { status: 500, headers: adminAuthCorsHeaders }
            );
          }
        }

        if (!data.departmentId) {
          return NextResponse.json(
            { error: "Department ID is required for department admin." },
            { status: 400, headers: adminAuthCorsHeaders }
          );
        }
      }

      // Call the handler with the processed data
      const jsonRequest = {
        ...request,
        json: async () => data,
      } as Request;
      
      return handleAdminSignup(jsonRequest);
    }
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500, headers: adminAuthCorsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: adminAuthCorsHeaders,
  });
}