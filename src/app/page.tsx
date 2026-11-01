import Link from "next/link";
import { ArrowUpRight, ArrowDown, MapPin, Zap } from "lucide-react";
import { snapshot } from "@/lib/repository";
import { isDemo } from "@/lib/config";
import {
  Header,
  Footer,
  Catalog,
  Locations,
  Process,
  Trust,
  FAQ,
  FinalCTA,
} from "@/components/public";
export const dynamic = "force-dynamic";
export default async function Home() {
  const s = await snapshot();
  return (
    <>
      <Header settings={s.settings} demo={isDemo()} />
      <main id="main">
        <section className="hero">
          <div className="container hero-grid">
            <div className="hero-copy">
              <span className="eyebrow">
                <span className="live-dot" /> CHIVABONO CL27 · GUADALAJARA
              </span>
              <h1>
                {s.settings.heroTitle === "El partido se vive juntos." ? (
                  <>
                    El partido
                    <br />
                    se vive
                    <br />
                    <span>
                      juntos
                      <svg
                        viewBox="0 0 300 14"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                      >
                        <path d="M3 9C70 1 210 0 295 8M30 13C140 5 250 5 288 10" />
                      </svg>
                      .
                    </span>
                  </>
                ) : (
                  s.settings.heroTitle
                )}
              </h1>
              <p>{s.settings.heroSubtitle}</p>
              <div className="hero-actions">
                <Link href="/partidos" className="button button-red">
                  Encuentra tu partido <ArrowUpRight size={19} />
                </Link>
                <a href="#lugares" className="text-link">
                  Conoce los lugares <ArrowDown size={16} />
                </a>
              </div>
              <div className="hero-proof">
                <span className="mini-seats">▰ ▰ ▰ ▰ ▰</span>
                <span>
                  5 juntos en Poniente
                  <br />
                  <strong>3 + 2 en Oriente</strong>
                </span>
              </div>
            </div>
            <div className="hero-visual">
              <img
                className="hero-photo"
                src={
                  s.media.find((m) => m.kind === "photo" && m.group === "all")
                    ? `/api/media/${s.media.find((m) => m.kind === "photo" && m.group === "all")!.id}`
                    : "/images/akron-real.jpg"
                }
                alt="Vista real de la cancha del Akron durante un partido, compartida por Relampamigos"
                fetchPriority="high"
              />
              <div className="hero-photo-shade" />
              <span className="hero-vertical">NOS VEMOS EN LA TRIBUNA</span>
              <div className="hero-photo-label">
                <MapPin size={16} />
                <span>
                  ESTADIO AKRON
                  <br />
                  <strong>ZAPOPAN, JALISCO</strong>
                </span>
              </div>
              <div className="hero-ticket">
                <div>
                  <span>EL MEJOR PLAN</span>
                  <Zap size={27} />
                </div>
                <strong>
                  FÚTBOL.
                  <br />
                  AMIGOS.
                  <br />Y EL REBAÑO.
                </strong>
                <div>
                  <span>LATERAL INFERIOR</span>
                  <span>10 LUGARES</span>
                </div>
              </div>
              <div className="hero-stamp">
                DE LA
                <br />
                TRIBUNA
                <br />
                <span>PARA TI ↗</span>
              </div>
            </div>
          </div>
        </section>
        <div className="ticker">
          <div className="container">
            <span>
              <Zap />
              PONIENTE · T1-04
            </span>
            <span>TRATO DIRECTO</span>
            <span>
              <Zap />
              ORIENTE · T1-24
            </span>
            <span>TRANSFERENCIA POR BOLETOMÓVIL</span>
          </div>
        </div>
        <section className="container section-space upcoming">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                <span className="section-number">01</span> EL SIGUIENTE
                SILBATAZO
              </span>
              <h2>
                Elige el partido.
                <br />
                Nosotros ponemos los lugares.
              </h2>
            </div>
            <Link href="/partidos" className="text-link">
              Todos los partidos <ArrowUpRight size={17} />
            </Link>
          </div>
          <Catalog initial={s} preview />
        </section>
        <Locations media={s.media} />
        <Process holdMinutes={s.settings.holdMinutes} />
        <Trust media={s.media} phone={s.settings.phone} />
        <FAQ holdMinutes={s.settings.holdMinutes} />
        <FinalCTA phone={s.settings.phone} />
      </main>
      <Footer settings={s.settings} />
    </>
  );
}
