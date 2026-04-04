"use client";
import { createContext, useContext } from "react";

export interface FacultyAdminInfo {
  id: string;
  fullName: string;
  email: string;
  role: string;
  institutionId: string;
  institutionName: string;
}

export const FacultyAdminContext = createContext<FacultyAdminInfo | null>(null);

export function useFacultyAdmin(): FacultyAdminInfo | null {
  return useContext(FacultyAdminContext);
}
