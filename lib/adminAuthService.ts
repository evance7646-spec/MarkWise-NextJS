import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, comparePassword } from "@/lib/hash";
import { normalizeEmail } from "@/lib/adminStore";
import { signAdminAuthToken } from "@/lib/adminAuthJwt";

export const adminAuthCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type AdminSignupBody = {
  fullName?: string;
  email?: string;
  password?: string;
  institutionId?: string;
  departmentId?: string;
  departmentName?: string;
  role?: string; // 'institution_admin' or 'department_admin'
};

type AdminSigninBody = {
  email?: string;
  password?: string;
};


export async function handleAdminSignup(request: Request) {
  try {
    const body = (await request.json()) as AdminSignupBody;
    let { fullName, institutionId, departmentId, departmentName, role } = body;
    const email = normalizeEmail(body.email ?? "");
    const password = body.password ?? "";


    // Strict role validation
    if (role !== "institution_admin" && role !== "department_admin") {
      return NextResponse.json(
        { error: "Role must be either 'institution_admin' or 'department_admin'." },
        { status: 400, headers: adminAuthCorsHeaders },
      );
    }

    // Institution admin: must NOT have departmentId or departmentName, must have institutionId
    if (role === "institution_admin") {
      if (!institutionId) {
        return NextResponse.json(
          { error: "Institution ID is required for institution admin." },
          { status: 400, headers: adminAuthCorsHeaders },
        );
      }
      if (departmentId || departmentName) {
        return NextResponse.json(
          { error: "Institution admin cannot have departmentId or departmentName." },
          { status: 400, headers: adminAuthCorsHeaders },
        );
      }
    }

    // Department admin: must have institutionId and (departmentId or departmentName)
    if (role === "department_admin") {
      if (!institutionId) {
        return NextResponse.json(
          { error: "Institution ID is required for department admin." },
          { status: 400, headers: adminAuthCorsHeaders },
        );
      }
      if (departmentName && departmentName.trim().length > 0) {
        // Try to create department, but handle unique constraint error gracefully
        try {
          const newDept = await prisma.department.create({
            data: {
              name: departmentName.trim(),
              institutionId,
            },
          });
          departmentId = newDept.id;
          departmentName = newDept.name;
        } catch (error: any) {
          if (error.code === 'P2002') {
            // Department already exists, fetch it
            const existingDept = await prisma.department.findFirst({
              where: {
                name: { equals: departmentName.trim(), mode: 'insensitive' },
                institutionId,
              },
            });
            if (existingDept) {
              departmentId = existingDept.id;
              departmentName = existingDept.name;
            } else {
              return NextResponse.json(
                { error: "Department already exists but could not be found." },
                { status: 500, headers: adminAuthCorsHeaders },
              );
            }
          } else {
            return NextResponse.json(
              { error: error.message || "Failed to create department." },
              { status: 500, headers: adminAuthCorsHeaders },
            );
          }
        }
      } else if (departmentId) {
        // Validate department exists
        const department = await prisma.department.findUnique({ where: { id: departmentId } });
        if (!department) {
          return NextResponse.json(
            { error: "Department does not exist. Please select or create a valid department." },
            { status: 400, headers: adminAuthCorsHeaders },
          );
        }
        departmentName = department.name;
      } else {
        return NextResponse.json(
          { error: "Department ID or department name is required for department admin." },
          { status: 400, headers: adminAuthCorsHeaders },
        );
      }
    }

    // Check if admin already exists
    const existingAdmin = await prisma.admin.findUnique({
      where: { email },
    });

    if (existingAdmin) {
      return NextResponse.json(
        { error: "An admin with this email already exists." },
        { status: 409, headers: adminAuthCorsHeaders },
      );
    }

    // Hash password and create admin
    const hashedPassword = await hashPassword(password);
    const adminData: any = {
      fullName,
      email,
      password: hashedPassword,
      institutionId: institutionId ?? undefined,
      role,
    };
    if (typeof departmentId === "string" && departmentId.length > 0) {
      adminData.departmentId = departmentId;
    }
    const admin = await prisma.admin.create({
      data: adminData,
    });

    return NextResponse.json(
      {
        success: true,
        admin: {
          id: admin.id,
          fullName: admin.fullName,
          email: admin.email,
          role: admin.role,
          institutionId: admin.institutionId,
          departmentId: admin.departmentId,
          departmentName: departmentName,
        },
      },
      { status: 201, headers: adminAuthCorsHeaders },
    );
  } catch (error) {
    console.error("Admin signup error:", error);
    return NextResponse.json(
      { error: "Failed to create admin account." },
      { status: 500, headers: adminAuthCorsHeaders },
    );
  }
}


export async function handleAdminSignin(request: Request) {
  try {
    const body = (await request.json()) as AdminSigninBody;
    const email = normalizeEmail(body.email ?? "");
    const password = body.password ?? "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400, headers: adminAuthCorsHeaders },
      );
    }

    const admin = await prisma.admin.findUnique({ 
      where: { email } 
    });
    
    if (!admin) {
      return NextResponse.json(
        { error: "Invalid credentials." }, 
        { status: 401, headers: adminAuthCorsHeaders }
      );
    }

    const isValidPassword = await comparePassword(password, admin.password);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Invalid credentials." }, 
        { status: 401, headers: adminAuthCorsHeaders }
      );
    }

    // Create JWT and set as HTTP-only cookie
    const token = signAdminAuthToken({
      adminId: admin.id,
      departmentId: admin.departmentId ?? null,
      institutionId: admin.institutionId ?? null,
      role: admin.role ?? null,
    });
    const response = NextResponse.json(
      {
        success: true,
        admin: {
          id: admin.id,
          fullName: admin.fullName,
          email: admin.email,
          role: admin.role,
          institutionId: admin.institutionId,
          departmentId: admin.departmentId,
        },
      },
      { status: 200, headers: adminAuthCorsHeaders },
    );
    response.cookies.set('admin_auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    return response;
  } catch (error) {
    console.error("Admin signin error:", error);
    return NextResponse.json(
      { error: "Failed to sign in admin." }, 
      { status: 500, headers: adminAuthCorsHeaders }
    );
  }
}

// Optional: Handle OPTIONS requests for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: adminAuthCorsHeaders,
  });
}