import { redirect } from "next/navigation";

export default function RegistryLoginRedirect() {
  redirect("/admin/login");
}
