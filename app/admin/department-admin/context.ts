"use client";
import { createContext, useContext } from "react";

export interface AdminInfo {
  id: string;
  fullName: string;
  email: string;
  role: string;
  departmentId: string;
  departmentName: string;
  institutionId: string;
}

export const AdminContext = createContext<AdminInfo | null>(null);

export function useAdmin(): AdminInfo | null {
  return useContext(AdminContext);
}
