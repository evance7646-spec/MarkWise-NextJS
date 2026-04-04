import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../../globals.css";

import RoomManagerShell from "./RoomManagerShell";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Space Admin - MarkWise",
  description: "Manage rooms, bookings, and campus facilities",
};

export default function RoomManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={inter.className}>
      <RoomManagerShell>{children}</RoomManagerShell>
    </div>
  );
}
