import type { Metadata } from "next";
import { snapshot } from "@/lib/repository";
import { isDemo } from "@/lib/config";
import { Header, Footer, Catalog, FinalCTA } from "@/components/public";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Próximos partidos" };
export default async function Matches() {
  const s = await snapshot();
  return (
    <>
      <Header settings={s.settings} demo={isDemo()} />
      <main id="main">
        <section className="catalog-intro container">
          <span className="eyebrow">AGENDA DE TRIBUNA</span>
          <h1>
            Tu próximo
            <br />
            <span className="text-red">gran plan.</span>
          </h1>
          <p>
            Encuentra partido, elige tus lugares y arma el grupo.
            <br />
            Todos los horarios son de Guadalajara.
          </p>
        </section>
        <section className="container catalog-section">
          <Catalog initial={s} />
        </section>
        <FinalCTA phone={s.settings.phone} />
      </main>
      <Footer settings={s.settings} />
    </>
  );
}
