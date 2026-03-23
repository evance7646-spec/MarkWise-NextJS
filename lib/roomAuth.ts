import { verifyLecturerAccessToken } from "@/lib/lecturerAuthJwt";
import { verifyRoomManagerJwt } from "@/lib/roomManagerAuthJwt";

export type RoomScope =
  | { ok: true; role: "admin" | "lecturer" | "roomManager"; userId: string }
  | { ok: false; status: number; error: string };

const extractBearerToken = (authorizationHeader: string | null) => {
  if (!authorizationHeader) return null;
  const [type, token] = authorizationHeader.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
};

export async function resolveRoomScope(request: Request): Promise<RoomScope> {

  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) {
    return {
      ok: false,
      status: 401,
      error: "Missing authorization. Provide admin or lecturer bearer token.",
    };
  }

  // Try admin token first
  try {
    const { verifyAdminAuthToken } = await import("@/lib/adminAuthJwt");
    const payload = verifyAdminAuthToken(token);
    if (payload && payload.adminId) {
      return {
        ok: true,
        role: "admin",
        userId: payload.adminId,
      };
    }
  } catch {}

  // Try lecturer token
  try {
    const payload = verifyLecturerAccessToken(token);
    return {
      ok: true,
      role: "lecturer",
      userId: payload.lecturerId,
    };
  } catch {}

  // Try room manager token
  try {
    const payload = verifyRoomManagerJwt(token);
    if (payload && payload.id) {
      return {
        ok: true,
        role: "roomManager",
        userId: payload.id,
      };
    }
  } catch {}

  return {
    ok: false,
    status: 401,
    error: "Invalid or expired admin, lecturer, or room manager token.",
  };
}
