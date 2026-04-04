"use client";
import { createContext, useContext } from "react";

export interface InstitutionAdminInfo {
  id: string;
  fullName: string;
  email: string;
  role: string;
  institutionId: string;
  institutionName: string;
}

export const InstitutionAdminContext = createContext<InstitutionAdminInfo | null>(null);

export function useInstitutionAdmin(): InstitutionAdminInfo | null {
  return useContext(InstitutionAdminContext);
}
