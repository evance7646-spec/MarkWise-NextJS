"use client";
import { createContext, useContext } from "react";

export interface RegistryAdminInfo {
  id: string;
  fullName: string;
  email: string;
  role: string;
  institutionId: string;
  institutionName: string;
}

export const RegistryAdminContext = createContext<RegistryAdminInfo | null>(null);

export function useRegistryAdmin(): RegistryAdminInfo | null {
  return useContext(RegistryAdminContext);
}
