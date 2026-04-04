import { redirect } from "next/navigation";

export default function FacultyLoginRedirect() {
  redirect("/admin/login");
}
