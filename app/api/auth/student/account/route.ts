import { NextResponse } from "next/server";
import { verifyStudentAccessToken } from "@/lib/studentAuthJwt";
import { getStudentAuthUsers, writeStudentAuthUsers } from "@/lib/studentAuthStore";
import { readStudents, writeStudents } from "@/lib/studentStore.server";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const extractBearerToken = (authorizationHeader: string | null) => {
  if (!authorizationHeader) return null;
  const [type, token] = authorizationHeader.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
};

export async function DELETE(request: Request) {
  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) {
    return NextResponse.json({ error: "Missing or invalid token." }, { status: 401, headers: corsHeaders });
  }

  let userId: string | null = null;
  try {
    const payload = verifyStudentAccessToken(token);
    userId = payload.userId;
  } catch {
    return NextResponse.json({ error: "Invalid or expired token." }, { status: 401, headers: corsHeaders });
  }

  // Remove student auth user
  const authUsers = await getStudentAuthUsers();
  const authUser = authUsers.find((u) => u.id === userId);
  if (!authUser) {
    return NextResponse.json({ error: "Account not found." }, { status: 404, headers: corsHeaders });
  }

  const updatedAuthUsers = authUsers.filter((u) => u.id !== userId);
  await writeStudentAuthUsers(updatedAuthUsers);

  // Remove student record
  const students = await readStudents();
  const updatedStudents = students.filter((s) => s.id !== authUser.studentId);
  await writeStudents(updatedStudents);

  // TODO: Remove sessions/tokens if you have a session store

  return NextResponse.json({ success: true }, { headers: corsHeaders });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}
