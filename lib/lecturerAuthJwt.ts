import jwt from "jsonwebtoken";

export type LecturerJwtPayload = {
  lecturerId: string;
  email: string;
  phoneNumber: string;
};

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured.");
  }
  return secret;
};

export const signLecturerAccessToken = (payload: LecturerJwtPayload) => {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
};

export const verifyLecturerAccessToken = (token: string) => {
  return jwt.verify(token, getJwtSecret()) as LecturerJwtPayload;
};
