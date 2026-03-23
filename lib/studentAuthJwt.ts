import jwt from "jsonwebtoken";

export type StudentJwtPayload = {
  userId: string;
  studentId: string;
  courseId?: string;
  admissionNumber: string;
  email: string;
};

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured.");
  }
  return secret;
};

export const signStudentAccessToken = (payload: StudentJwtPayload) => {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
};

export const verifyStudentAccessToken = (token: string) => {
  return jwt.verify(token, getJwtSecret()) as StudentJwtPayload;
};
