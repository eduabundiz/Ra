import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { LoginForm } from "@/components/admin";
import { Brand } from "@/components/public";
export const dynamic = "force-dynamic";
export default async function Password() {
  if (!(await getAdmin())) redirect("/admin/login");
  return (
    <main id="main" className="login-content password-page">
      <Brand />
      <h1>Tu acceso al equipo.</h1>
      <p>Define una contraseña de al menos 12 caracteres.</p>
      <LoginForm passwordMode />
    </main>
  );
}
