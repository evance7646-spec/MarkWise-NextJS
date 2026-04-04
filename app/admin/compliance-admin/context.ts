"use client";
import { createContext, useContext } from "react";

export interface ComplianceAdminInfo {
  id: string;
  fullName: string;
  email: string;
  role: string;
  institutionId: string;
  institutionName: string;
}

export const ComplianceAdminContext = createContext<ComplianceAdminInfo | null>(null);

export function useComplianceAdmin(): ComplianceAdminInfo | null {
  return useContext(ComplianceAdminContext);
}
