import jwt from "jsonwebtoken";

export type RoomManagerJwtPayload = {
  id: string;
  email: string;
  institutionId: string;
};

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured.");
  return secret;
};

export const signRoomManagerToken = (payload: RoomManagerJwtPayload): string => {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
};

export const verifyRoomManagerJwt = (token: string): RoomManagerJwtPayload => {
  return jwt.verify(token, getJwtSecret()) as RoomManagerJwtPayload;
};
