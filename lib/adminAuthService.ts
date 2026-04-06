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
  role?: string;
  // system_admin fields
  institutionId?: string;   // existing institution — skip creation when provided
  institutionName?: string; // new institution name — used when institutionId is absent
  logoUrl?: string;
  logo?: string;            // legacy alias for logoUrl (multipart upload filename)
  // (legacy department fields — no longer used by registerable roles)
  departmentId?: string;    // existing department — skip creation when provided
  departmentName?: string;  // new/existing department name — find-or-create when departmentId absent
};

type AdminSigninBody = {
  email?: string;
  password?: string;
};

export async function handleAdminSignup(request: Request) {
  try {
    const body = (await request.json()) as AdminSignupBody;
    let { institutionId, departmentId, departmentName, role } = body;
    const fullName = body.fullName?.trim() ?? "";
    const email = normalizeEmail(body.email ?? "");
    const password = body.password ?? "";

    // ── Input validation ─────────────────────────────────────────────────────
    if (!fullName) {
      return NextResponse.json(
        { error: "Full name is required." },
        { status: 400, headers: adminAuthCorsHeaders },
      );
    }
    if (!email) {
      return NextResponse.json(
        { error: "Email is required." },
        { status: 400, headers: adminAuthCorsHeaders },
      );
    }
    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400, headers: adminAuthCorsHeaders },
      );
    }
    const REGISTERABLE_ROLES = [
      "system_admin",
      "academic_registrar",
      "facilities_manager",
      "department_admin",
    ];
    if (!REGISTERABLE_ROLES.includes(role ?? "")) {
      return NextResponse.json(
        { error: "Invalid role for self-registration." },
        { status: 400, headers: adminAuthCorsHeaders },
      );
    }

    // ── Email uniqueness check FIRST — before creating any related records ───
    const existingAdmin = await prisma.admin.findUnique({ where: { email } });
    if (existingAdmin) {
      return NextResponse.json(
        { error: "An admin with this email already exists." },
        { status: 409, headers: adminAuthCorsHeaders },
      );
    }

    const hashedPassword = await hashPassword(password);
    let admin: Awaited<ReturnType<typeof prisma.admin.create>>;

    // ── system_admin ─────────────────────────────────────────────────────────
    if (role === "system_admin") {
      const institutionName = body.institutionName?.trim() || `${fullName} Institution`;
      const logoUrl = body.logoUrl || body.logo || null;

      // Create institution + admin atomically so a failed admin creation
      // never leaves an orphaned institution row.
      if (institutionId) {
        // Registering against an existing institution
        const institutionExists = await prisma.institution.findUnique({
          where: { id: institutionId },
          select: { id: true },
        });
        if (!institutionExists) {
          return NextResponse.json(
            { error: "Institution not found." },
            { status: 404, headers: adminAuthCorsHeaders },
          );
        }
        admin = await prisma.admin.create({
          data: { fullName, email, password: hashedPassword, institutionId, role },
        });
      } else {
        // Creating a brand-new institution alongside the admin
        admin = await prisma.$transaction(async (tx) => {
          const institution = await tx.institution.create({
            data: { name: institutionName, logoUrl },
          });
          return tx.admin.create({
            data: {
              fullName,
              email,
              password: hashedPassword,
              institutionId: institution.id,
              role,
            },
          });
        });
      }

      return NextResponse.json(
        {
          success: true,
          admin: {
            id: admin.id,
            fullName: admin.fullName,
            email: admin.email,
            role: admin.role,
            institutionId: admin.institutionId,
            departmentId: null,
            departmentName: null,
          },
        },
        { status: 201, headers: adminAuthCorsHeaders },
      );
    }

    // ── institution-level roles (no department) ───────────────────────────────
    const INSTITUTION_LEVEL_ROLES = ["academic_registrar", "facilities_manager"];
    if (INSTITUTION_LEVEL_ROLES.includes(role!)) {
      if (!institutionId) {
        return NextResponse.json(
          { error: "Institution ID is required for this role." },
          { status: 400, headers: adminAuthCorsHeaders },
        );
      }
      const institutionExists = await prisma.institution.findUnique({
        where: { id: institutionId },
        select: { id: true },
      });
      if (!institutionExists) {
        return NextResponse.json(
          { error: "Institution not found." },
          { status: 404, headers: adminAuthCorsHeaders },
        );
      }
      const newAdmin = await prisma.admin.create({
        data: { fullName, email, password: hashedPassword, institutionId, role: role as any },
      });
      return NextResponse.json(
        {
          success: true,
          admin: {
            id: newAdmin.id,
            fullName: newAdmin.fullName,
            email: newAdmin.email,
            role: newAdmin.role,
            institutionId: newAdmin.institutionId,
            departmentId: null,
            departmentName: null,
          },
        },
        { status: 201, headers: adminAuthCorsHeaders },
      );
    }

    // ── department_admin: requires institution + department ────────────────────
    if (!institutionId) {
      return NextResponse.json(
        { error: "Institution ID is required for department admin." },
        { status: 400, headers: adminAuthCorsHeaders },
      );
    }

    // Resolve department: prefer departmentId → find-or-create by name
    if (departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: departmentId } });
      if (!dept) {
        return NextResponse.json(
          { error: "Department not found." },
          { status: 404, headers: adminAuthCorsHeaders },
        );
      }
      departmentName = dept.name;
    } else if (departmentName?.trim()) {
      const trimmedName = departmentName.trim();
      // Find existing (case-insensitive) or create
      const existing = await prisma.department.findFirst({
        where: {
          name: { equals: trimmedName, mode: "insensitive" },
          institutionId,
        },
      });
      if (existing) {
        departmentId = existing.id;
        departmentName = existing.name;
      } else {
        try {
          const newDept = await prisma.department.create({
            data: { name: trimmedName, institutionId },
          });
          departmentId = newDept.id;
          departmentName = newDept.name;
        } catch (err: any) {
          if (err.code === "P2002") {
            // Created concurrently — fetch the winner
            const concurrent = await prisma.department.findFirst({
              where: {
                name: { equals: trimmedName, mode: "insensitive" },
                institutionId,
              },
            });
            if (!concurrent) {
              return NextResponse.json(
                { error: "Department creation failed. Please try again." },
                { status: 500, headers: adminAuthCorsHeaders },
              );
            }
            departmentId = concurrent.id;
            departmentName = concurrent.name;
          } else {
            throw err;
          }
        }
      }
    } else {
      return NextResponse.json(
        { error: "Department ID or department name is required for department admin." },
        { status: 400, headers: adminAuthCorsHeaders },
      );
    }

    admin = await prisma.admin.create({
      data: {
        fullName,
        email,
        password: hashedPassword,
        institutionId,
        departmentId,
        role: role as any,
      },
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
          departmentName,
        },
      },
      { status: 201, headers: adminAuthCorsHeaders },
    );
  } catch (error) {
    console.error("Admin signup error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: message },
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