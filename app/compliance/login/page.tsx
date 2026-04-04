import { redirect } from "next/navigation";

export default function ComplianceLoginRedirect() {
  redirect("/admin/login");
}
