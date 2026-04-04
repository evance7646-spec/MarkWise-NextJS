"use client";
import { createContext, useContext } from "react";

export interface SpaceAdminInfo {
  id: string;
  fullName: string;
  email: string;
  role: string;
  institutionId: string;
  institutionName: string;
}

export const SpaceAdminContext = createContext<SpaceAdminInfo | null>(null);

export function useSpaceAdmin(): SpaceAdminInfo | null {
  return useContext(SpaceAdminContext);
}
