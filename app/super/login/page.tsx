import { redirect } from "next/navigation";

export default function SuperLoginRedirect() {
  redirect("/admin/login");
}
