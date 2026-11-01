import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { isDemo } from "@/lib/config";
import { LoginForm } from "@/components/admin";
import { Brand } from "@/components/public";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Acceso al panel",
  robots: { index: false, follow: false },
};
export default async function Login() {
  if (await getAdmin()) redirect("/admin");
  return (
    <main id="main" className="login-page">
      <div className="login-story">
        <span className="eyebrow">LA TRIBUNA, EN ORDEN.</span>
        <h1>
          El plan
          <br />
          empieza
          <br />
          aquí<span>.</span>
        </h1>
        <p>
          Chivabonos Relampamigos
          <br />
          Administración de lugares y partidos.
        </p>
        <img src="/images/akron-real.jpg" alt="" />
      </div>
      <div className="login-content">
        <Brand />
        <span className="eyebrow">ACCESO DEL EQUIPO</span>
        <h2>Hola, Relampamigo.</h2>
        <p>Entra para preparar el próximo partido.</p>
        <LoginForm demo={isDemo()} />
      </div>
    </main>
  );
}
