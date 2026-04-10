import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../../globals.css";

import FacilitiesManagerShell from "./FacilitiesManagerShell";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Facilities Manager - MarkWise",
  description: "Manage rooms, bookings, and campus facilities",
};

export default function FacilitiesManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={inter.className}>
      <FacilitiesManagerShell>{children}</FacilitiesManagerShell>
    </div>
  );
}
