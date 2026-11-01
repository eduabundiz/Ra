"use client";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { useState, useEffect, useRef, useId, type ReactNode } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Menu,
  X,
  MapPin,
  Clock3,
  ShieldCheck,
  MessageCircle,
  Check,
  Ticket,
  ChevronDown,
  Users,
  Zap,
  CalendarDays,
  ExternalLink,
} from "lucide-react";
import {
  SEATS,
  PACKAGES,
  availability,
  matchDate,
  matchTime,
  money,
  quote,
  type State,
  type Match,
  type Inventory,
  type Settings,
} from "@/lib/domain";

export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Relampamigos, inicio">
      <img src="/images/relampamigos-mark.png" alt="" width="47" height="53" />
      <span>
        <small>CHIVABONOS</small>
        <strong>
          RELAMPAMIGOS<span className="brand-dot">.</span>
        </strong>
      </span>
    </Link>
  );
}
export function WhatsAppLink({
  phone,
  children,
  className = "button button-dark",
}: {
  phone: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={`https://wa.me/${phone}?text=${encodeURIComponent("¡Hola, Relampamigos! Me gustaría información de sus lugares para un próximo partido.")}`}
      className={className}
      target="_blank"
      rel="noopener noreferrer"
    >
      <MessageCircle size={18} />
      {children || "Platiquemos por WhatsApp"}
      <ArrowUpRight size={16} />
    </a>
  );
}
export function Header({
  settings,
  demo,
}: {
  settings: Settings;
  demo: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {demo && (
        <div className="demo-banner">
          VISTA DE DEMOSTRACIÓN{" "}
          <span>
            · Partidos y precios de muestra. No representan una oferta de venta.
          </span>
          <Link href="/admin">
            Ver panel <ArrowUpRight size={12} />
          </Link>
        </div>
      )}
      <div className="topline">
        <span>GUADALAJARA, JALISCO</span>
        <span>
          DE AFICIONADOS, PARA AFICIONADOS <Zap size={11} />
        </span>
      </div>
      <header className="site-header">
        <div className="container nav">
          <Brand />
          <nav
            className={open ? "main-nav is-open" : "main-nav"}
            aria-label="Navegación principal"
          >
            <Link href="/partidos" onClick={() => setOpen(false)}>
              Partidos
            </Link>
            <Link href="/#lugares" onClick={() => setOpen(false)}>
              Nuestros lugares
            </Link>
            <Link href="/#como-comprar" onClick={() => setOpen(false)}>
              Cómo comprar
            </Link>
            <WhatsAppLink
              phone={settings.phone}
              className="button button-red nav-contact"
            >
              Hablemos
            </WhatsAppLink>
          </nav>
          <button
            className="menu-toggle icon-button"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </header>
    </>
  );
}
export function Footer({ settings }: { settings: Settings }) {
  return (
    <footer className="footer">
      <div className="container footer-top">
        <div>
          <Brand />
          <p>
            El plan empieza con los amigos.
            <br />
            La historia se escribe en la tribuna.
          </p>
        </div>
        <div>
          <span className="eyebrow">NOS VEMOS EN EL AKRON</span>
          <WhatsAppLink phone={settings.phone} className="footer-contact">
            33 1458 1203
          </WhatsAppLink>
          <small>Horario de Guadalajara · México</small>
        </div>
      </div>
      <div className="container footer-bottom">
        <p>
          Vendedor independiente. Sin afiliación oficial con Club Deportivo
          Guadalajara ni Boletomóvil. Las marcas mencionadas pertenecen a sus
          titulares.
        </p>
        <div>
          <Link href="/privacidad">Privacidad</Link>
          <Link href="/terminos">Condiciones</Link>
          <Link href="/admin">Administración</Link>
        </div>
        <small>© {new Date().getFullYear()} Relampamigos</small>
      </div>
    </footer>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const d = ref.current;
    const focused = document.activeElement as HTMLElement;
    d?.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      d?.close();
      document.body.style.overflow = old;
      focused?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal-head">
        <h2 id={id}>{title}</h2>
        <button className="icon-button" aria-label="Cerrar" onClick={onClose}>
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function usePublicState(initial: State) {
  const [s, setS] = useState(initial);
  useEffect(() => {
    let live = true;
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      fetch("/api/catalog", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((v) => {
          if (live && v) setS(v);
        })
        .catch(() => {});
    };
    let cleanRealtime: undefined | (() => void);
    if (
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ) {
      const sb = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      );
      const channel = sb
        .channel("public-availability")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "seat_inventory" },
          refresh,
        )
        .subscribe();
      cleanRealtime = () => {
        void sb.removeChannel(channel);
      };
    }
    const interval = setInterval(refresh, 5000);
    window.addEventListener("focus", refresh);
    return () => {
      live = false;
      cleanRealtime?.();
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return s;
}
export function MatchCard({
  match,
  inventory,
  media,
}: {
  match: Match;
  inventory: Inventory[];
  media?: State["media"];
}) {
  const status = availability(inventory);
  const prices = PACKAGES.filter((p) => match.prices[p.id]);
  const lowest = prices.length
    ? Math.min(...prices.map((p) => match.prices[p.id]!))
    : null;
  const logo = media?.find((m) => m.id === match.opponentLogoId);
  return (
    <article className="match-card">
      <div className="match-card-top">
        <span
          className={`status status-${status.available ? "available" : status.label === "Reservado" ? "reserved" : "sold"}`}
        >
          <i />
          {status.label}
        </span>
        <span className="small-label">{match.competition}</span>
      </div>
      <div className="teams">
        <div>
          <span className="team-mark gdl">
            GDL<span>GUADALAJARA</span>
          </span>
          <strong>Guadalajara</strong>
        </div>
        <span className="versus">VS</span>
        <div>
          {logo ? (
            <img
              className="team-mark"
              src={`/api/media/${logo.id}`}
              alt={`Emblema de ${match.opponent}`}
            />
          ) : (
            <span className="team-mark away">
              {match.opponent
                .split(" ")
                .slice(0, 2)
                .map((s) => s[0])
                .join("")}
            </span>
          )}
          <strong>{match.opponent}</strong>
        </div>
      </div>
      <div className="match-meta">
        <span>
          <CalendarDays size={15} />
          {matchDate(match.kickoff)}
        </span>
        <span>
          <Clock3 size={15} />
          {matchTime(match.kickoff)} · GDL
        </span>
        <span>
          <MapPin size={15} />
          {match.stadium}
        </span>
      </div>
      <div className="card-bottom">
        <div>
          <span className="small-label">
            {lowest ? "GRUPOS DESDE" : "PRECIO"}
          </span>
          <strong>
            {lowest ? money(lowest) : "Por confirmar"}
            <small> MXN</small>
          </strong>
          <span>{status.available} de 10 lugares disponibles</span>
        </div>
        <Link
          href={`/partidos/${match.slug}`}
          className="round-link"
          aria-label={`Ver lugares para Guadalajara vs ${match.opponent}`}
        >
          <ArrowUpRight />
        </Link>
      </div>
      {match.demo && (
        <div className="sample-label">
          PARTIDO Y PRECIOS DE MUESTRA · SIN VENTA REAL
        </div>
      )}
    </article>
  );
}
export function Catalog({
  initial,
  preview = false,
}: {
  initial: State;
  preview?: boolean;
}) {
  const state = usePublicState(initial);
  const [filter, setFilter] = useState("upcoming");
  let matches = state.matches
    .filter((m) => new Date(m.kickoff) > new Date())
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  if (filter === "available")
    matches = matches.filter((m) =>
      state.inventory.some(
        (i) => i.matchId === m.id && i.status === "available",
      ),
    );
  if (preview) matches = matches.slice(0, 3);
  return (
    <>
      {!preview && (
        <div className="catalog-filters">
          <div className="segmented" aria-label="Filtrar partidos">
            <button
              aria-pressed={filter === "upcoming"}
              onClick={() => setFilter("upcoming")}
            >
              Próximos partidos
            </button>
            <button
              aria-pressed={filter === "available"}
              onClick={() => setFilter("available")}
            >
              Con lugares disponibles
            </button>
          </div>
          <span className="small-label">
            {matches.length} {matches.length === 1 ? "PARTIDO" : "PARTIDOS"} ·
            HORA DE GUADALAJARA
          </span>
        </div>
      )}
      {matches.length ? (
        <div className="match-grid">
          {matches.map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              inventory={state.inventory.filter((i) => i.matchId === m.id)}
              media={state.media}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-icon">
            <Ticket size={32} />
          </span>
          <h3>Pronto habrá partidos.</h3>
          <p>
            {filter === "available"
              ? "Por ahora no hay lugares disponibles. Escríbenos para conocer próximas oportunidades."
              : "Estamos preparando los próximos planes en el Akron. Escríbenos y te contamos cuando haya lugares."}
          </p>
          <WhatsAppLink phone={state.settings.phone}>
            Quiero saber más
          </WhatsAppLink>
        </div>
      )}
    </>
  );
}
export function SeatDiagram({
  group,
  inventory,
  selected = [],
  onSelect,
}: {
  group: "A" | "B";
  inventory?: Inventory[];
  selected?: string[];
  onSelect?: (id: string) => void;
}) {
  const rows = group === "A" ? ["S"] : ["R", "Q"];
  return (
    <div className={`seat-diagram group-${group}`}>
      <div className="pitch-edge">
        <span>HACIA LA CANCHA</span>
        <i />
      </div>
      {[...rows].reverse().map((row) => (
        <div className={`seat-row row-${row}`} key={row}>
          <span className="row-label">FILA {row}</span>
          <div>
            {SEATS.filter((s) => s.group === group && s.row === row).map(
              (seat) => {
                const status =
                  inventory?.find((i) => i.seatId === seat.id)?.status ||
                  "available";
                const classes = `seat ${status} ${selected.includes(seat.id) ? "selected" : ""}`;
                return onSelect ? (
                  <button
                    key={seat.id}
                    className={classes}
                    aria-pressed={selected.includes(seat.id)}
                    aria-label={`Sección ${seat.section}, fila ${seat.row}, asiento ${seat.number}, ${status === "available" ? "disponible" : status === "reserved" ? "reservado" : "vendido"}`}
                    disabled={status !== "available"}
                    onClick={() => onSelect(seat.id)}
                  >
                    {seat.number}
                  </button>
                ) : (
                  <span className={classes} key={seat.id}>
                    {seat.number}
                  </span>
                );
              },
            )}
          </div>
        </div>
      ))}
      <small className="diagram-note">
        Esquema de distribución · sin escala
      </small>
    </div>
  );
}
export function Locations({ media = [] }: { media?: State["media"] }) {
  const [map, setMap] = useState(false);
  return (
    <section id="lugares" className="locations section-space">
      <div className="container">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              <span className="section-number">02</span> ELIGE TU TRIBUNA
            </span>
            <h2>
              Buenos lugares.
              <br />
              <span className="text-red">Mejor compañía.</span>
            </h2>
          </div>
          <p>
            Diez lugares en lateral inferior.
            <br />
            Dos lados del Akron.
            <br />
            Un mismo sentimiento.
          </p>
        </div>
        <div className="location-grid">
          {(["A", "B"] as const).map((group) => (
            <article className="location-card" key={group}>
              <div className="location-title">
                <span className="giant-number">
                  {group === "A" ? "04" : "24"}
                </span>
                <div>
                  <span className="eyebrow">
                    GRUPO {group} · SECCIÓN T1-{group === "A" ? "04" : "24"}
                  </span>
                  <h3>{group === "A" ? "Poniente" : "Oriente"}</h3>
                  <p>Lateral inferior</p>
                </div>
                <ArrowUpRight />
              </div>
              <SeatDiagram group={group} />
              {media.find((m) => m.group === group && m.kind === "photo") && (
                <img
                  className="location-photo"
                  src={`/api/media/${media.find((m) => m.group === group && m.kind === "photo")!.id}`}
                  alt={
                    media.find((m) => m.group === group && m.kind === "photo")!
                      .title
                  }
                  loading="lazy"
                />
              )}
              <div className="location-caption">
                <Users size={18} />
                <span>
                  {group === "A"
                    ? "5 consecutivos · Fila S"
                    : "3 en fila R + 2 en fila Q"}
                </span>
                <span>5 LUGARES</span>
              </div>
            </article>
          ))}
        </div>
        <div className="location-footnote">
          <span>
            <MapPin size={15} /> Ubicaciones distintas: los grupos A y B no
            están juntos.
          </span>
          <button className="text-link" onClick={() => setMap(true)}>
            Ver mapa del estadio <ArrowUpRight size={15} />
          </button>
        </div>
      </div>
      {map && (
        <Modal title="Ubicación en el Akron" onClose={() => setMap(false)}>
          <img
            className="stadium-map"
            src="/images/mapa-akron.jpg"
            alt="Mapa general del estadio proporcionado por el vendedor. Oriente arriba y Poniente abajo."
          />
          <p>
            Grupo A: T1-04, Lateral Inferior Poniente. Grupo B: T1-24, Lateral
            Inferior Oriente. El mapa general es orientativo; los nombres de
            sección provienen de las capturas de los lugares.
          </p>
        </Modal>
      )}
    </section>
  );
}
export function Process({ holdMinutes = 30 }: { holdMinutes?: number }) {
  const steps = [
    [
      "Elige el plan",
      "Revisa el partido, la ubicación y el precio completo del grupo. La venta individual aparece cuando está habilitada.",
    ],
    [
      "Hablemos y apartamos",
      `Envíanos la selección por WhatsApp. Confirmamos disponibilidad y acordamos el apartado. Plazo orientativo: ${holdMinutes} minutos; lo revisamos contigo y lo administramos manualmente.`,
    ],
    [
      "Pago acordado contigo",
      "Te confirmamos por WhatsApp el total y el medio de pago. Sin cargos adicionales. El pago se acuerda directamente; no se captura información bancaria en esta página.",
    ],
    [
      "Transferencia a tu cuenta",
      "Necesitas la app de Boletomóvil y una cuenta registrada. Coordinamos la transferencia para ese partido y verificamos contigo que el acceso aparezca en tu cuenta.",
    ],
  ];
  return (
    <section id="como-comprar" className="process section-space">
      <div className="container">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              <span className="section-number">03</span> DEL CHAT A LA TRIBUNA
            </span>
            <h2>
              Así armamos
              <br />
              el plan.
            </h2>
          </div>
          <p>
            Trato directo de principio a fin.
            <br />
            En cada paso, sabes qué sigue.
          </p>
        </div>
        <div className="steps">
          {steps.map(([title, text], i) => (
            <article key={title}>
              <span className="step-number">0{i + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
              {i < 3 && <ArrowRight className="step-arrow" size={20} />}
            </article>
          ))}
        </div>
        <p className="process-note">
          <ShieldCheck size={17} /> Una consulta no aparta lugares. La reserva
          existe cuando te la confirmamos.{" "}
          <a
            href="https://www.boletomovil.com/chivas"
            target="_blank"
            rel="noopener noreferrer"
          >
            Información oficial de Boletomóvil <ExternalLink size={12} />
          </a>
        </p>
      </div>
    </section>
  );
}
export function Trust({
  media,
  phone,
}: {
  media: State["media"];
  phone: string;
}) {
  media = media.filter((m) => m.kind !== "logo");
  const cover = media.find((m) => m.kind === "photo" && m.group === "all");
  return (
    <section className="trust section-space" id="confianza">
      <div className="container trust-grid">
        <div className="trust-photo">
          <img
            src={cover ? `/api/media/${cover.id}` : "/images/akron-real.jpg"}
            alt={
              cover?.title ||
              "Fotografía del partido desde la tribuna proporcionada por Relampamigos"
            }
            loading="lazy"
          />
          <div className="photo-caption">
            <span className="live-dot" /> FOTO REAL COMPARTIDA POR RELAMPAMIGOS
          </div>
        </div>
        <div className="trust-copy">
          <span className="eyebrow">GENTE REAL. LUGARES REALES.</span>
          <h2>
            La confianza
            <br />
            también juega.
          </h2>
          <p>
            Somos un grupo de aficionados con acceso a diez lugares de
            Chivabono. Queremos que más amigos vivan el partido desde la
            tribuna.
          </p>
          <ul className="trust-list">
            <li>
              <Check />
              Ubicación y configuración claras antes de acordar.
            </li>
            <li>
              <Check />
              Precio total confirmado, sin cargos adicionales.
            </li>
            <li>
              <Check />
              Transferencia por Boletomóvil y revisión del acceso contigo.
            </li>
            <li>
              <Check />
              Contacto directo para resolver tus dudas.
            </li>
          </ul>
          <p className="small-note">
            Somos vendedores independientes. Boletomóvil es el mecanismo de
            transferencia; su uso no implica que avale esta venta ni constituye
            por sí solo una garantía de pago.
          </p>
          <WhatsAppLink phone={phone} className="text-link">
            Conoce a los Relampamigos
          </WhatsAppLink>
        </div>
      </div>
      {media.filter((m) => m.id !== cover?.id).length > 0 && (
        <div className="container evidence-grid">
          {media
            .filter((m) => m.id !== cover?.id)
            .map((m) => (
              <figure key={m.id}>
                <img src={`/api/media/${m.id}`} alt={m.title} loading="lazy" />
                <figcaption>{m.title}</figcaption>
              </figure>
            ))}
        </div>
      )}
    </section>
  );
}
export function FAQ({ holdMinutes = 30 }: { holdMinutes?: number }) {
  const questions = [
    [
      "¿Tengo que comprar los cinco lugares?",
      "Nuestra prioridad son los grupos: cinco juntos en Poniente y opciones de cinco, tres o dos en Oriente, según el partido y la disponibilidad. Si habilitamos la venta individual, podrás seleccionar los asientos desde el detalle del partido.",
    ],
    [
      "¿Los diez lugares están juntos?",
      "Son dos ubicaciones distintas. El Grupo A está en T1-04, Lateral Inferior Poniente: cinco consecutivos en fila S. El Grupo B está en T1-24, Lateral Inferior Oriente: tres en fila R y dos en fila Q.",
    ],
    [
      "¿Mandar un WhatsApp ya reserva mis lugares?",
      `Todavía no. Primero confirmamos disponibilidad contigo. Cuando acordamos el apartado, lo marcamos como reservado. El plazo orientativo es de ${holdMinutes} minutos; nosotros revisamos y cambiamos el estado manualmente.`,
    ],
    [
      "¿Cómo recibo mis accesos?",
      "Coordinamos la transferencia del acceso del partido por Boletomóvil. Debes tener una cuenta registrada en su app. Verificamos contigo que aparezca el acceso; no enviamos fotos de códigos QR como sustituto de la transferencia.",
    ],
    [
      "¿El precio tiene cargos extra?",
      "El total que acordamos por WhatsApp es el total que pagas. No agregamos cargos adicionales.",
    ],
    [
      "¿Qué pasa si el partido cambia o necesito cancelar?",
      "Antes de cerrar la compra acordamos contigo las condiciones aplicables a cancelaciones y reprogramaciones. El calendario y los requisitos de ingreso dependen del organizador. Consulta esas condiciones y aclara cualquier duda antes de pagar.",
    ],
    [
      "¿Esta es una página oficial de Chivas?",
      "Somos vendedores independientes. No tenemos afiliación oficial con Club Deportivo Guadalajara ni con Boletomóvil.",
    ],
  ];
  return (
    <section className="faq section-space">
      <div className="container faq-grid">
        <div>
          <span className="eyebrow">ANTES DEL SILBATAZO</span>
          <h2>
            Las dudas
            <br />
            también se resuelven.
          </h2>
          <p>Todo claro antes de hacer el plan.</p>
        </div>
        <div>
          {questions.map(([q, a]) => (
            <details key={q}>
              <summary>
                {q}
                <ChevronDown size={18} />
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
export function FinalCTA({ phone }: { phone: string }) {
  return (
    <section className="final-cta">
      <div className="container">
        <Zap className="cta-zap" />
        <div>
          <span className="eyebrow">
            LOS BUENOS PLANES NO SE QUEDAN EN EL CHAT
          </span>
          <h2>¿Quién se apunta?</h2>
        </div>
        <WhatsAppLink phone={phone} className="button button-cream">
          Arma tu plan por WhatsApp
        </WhatsAppLink>
      </div>
    </section>
  );
}
export function MatchExperience({
  initial,
  slug,
}: {
  initial: State;
  slug: string;
}) {
  const s = usePublicState(initial),
    match = s.matches.find((m) => m.slug === slug);
  const [mode, setMode] = useState("group"),
    [selected, setSelected] = useState<string[]>([]),
    [pack, setPack] = useState<string | undefined>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [chat, setChat] = useState<{
      url: string;
      text: string;
      demo: boolean;
    } | null>(null);
  if (!match)
    return (
      <div className="container section-space">
        <h1>Este partido dejó de estar disponible.</h1>
        <Link href="/partidos">Ver otros partidos</Link>
      </div>
    );
  const inventory = s.inventory.filter((i) => i.matchId === match.id);
  const selectionValid =
    selected.length > 0 &&
    selected.every((id) =>
      inventory.some((i) => i.seatId === id && i.status === "available"),
    );
  const started = new Date(match.kickoff) <= new Date();
  let total = 0;
  try {
    if (selected.length) total = quote(match, selected, pack);
  } catch {}
  async function contact() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: match!.id,
          seatIds: selected,
          packageId: pack,
          requestId: crypto.randomUUID(),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setChat(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function choosePack(id: string) {
    const p = PACKAGES.find((p) => p.id === id)!;
    setPack(id);
    setSelected([...p.seatIds]);
    setError("");
  }
  return (
    <>
      <section className="detail-hero">
        <div className="container">
          <Link className="breadcrumb" href="/partidos">
            Partidos /
          </Link>
          <span className="eyebrow">{match.competition}</span>
          <h1>
            Guadalajara <span>vs</span>
            <br />
            {match.opponent}
          </h1>
          <div className="detail-meta">
            <span>
              <CalendarDays size={18} />
              {matchDate(match.kickoff)}
            </span>
            <span>
              <Clock3 size={18} />
              {matchTime(match.kickoff)} · Guadalajara
            </span>
            <span>
              <MapPin size={18} />
              {match.stadium}
            </span>
          </div>
          {match.demo && (
            <p className="demo-inline">
              Partido, fecha y precios de demostración. No hay una oferta de
              venta real.
            </p>
          )}
        </div>
        <span className="detail-watermark" aria-hidden="true">
          GDL
        </span>
      </section>
      <section className="container detail-grid section-space">
        <div>
          <div className="section-heading">
            <div>
              <span className="eyebrow">TU LUGAR EN EL PARTIDO</span>
              <h2>Elige la tribuna.</h2>
            </div>
          </div>
          {match.allowIndividual && (
            <div className="segmented selection-mode">
              <button
                aria-pressed={mode === "group"}
                onClick={() => {
                  setMode("group");
                  setSelected([]);
                  setPack(undefined);
                }}
              >
                Por grupo
              </button>
              <button
                aria-pressed={mode === "individual"}
                onClick={() => {
                  setMode("individual");
                  setSelected([]);
                  setPack(undefined);
                }}
              >
                Asientos individuales
              </button>
            </div>
          )}
          <div className="seat-legend">
            <span>
              <i className="available" />
              Disponible
            </span>
            <span>
              <i className="reserved" />
              Reservado
            </span>
            <span>
              <i className="sold" />
              Vendido
            </span>
            <span>
              <i className="selected" />
              Tu selección
            </span>
          </div>
          {(["A", "B"] as const).map((group) => (
            <article className="selection-card" key={group}>
              <div className="selection-title">
                <div>
                  <span className="eyebrow">
                    GRUPO {group} · T1-{group === "A" ? "04" : "24"}
                  </span>
                  <h3>
                    {group === "A" ? "Poniente" : "Oriente"}{" "}
                    <small>Lateral inferior</small>
                  </h3>
                </div>
                <span>
                  {
                    inventory.filter(
                      (i) =>
                        i.status === "available" &&
                        SEATS.some(
                          (seat) =>
                            seat.id === i.seatId && seat.group === group,
                        ),
                    ).length
                  }
                  /5 libres
                </span>
              </div>
              <SeatDiagram
                group={group}
                inventory={inventory}
                selected={selected}
                onSelect={
                  mode === "individual"
                    ? (id) => {
                        setPack(undefined);
                        setSelected((prev) =>
                          prev.includes(id)
                            ? prev.filter((s) => s !== id)
                            : [...prev, id],
                        );
                      }
                    : undefined
                }
              />
              {mode === "group" ? (
                <div className="offer-list">
                  {PACKAGES.filter((p) => p.group === group).map((p) => {
                    const price = match.prices[p.id];
                    const ready = p.seatIds.every((id) =>
                      inventory.some(
                        (i) => i.seatId === id && i.status === "available",
                      ),
                    );
                    return price ? (
                      <button
                        className={`offer ${pack === p.id ? "chosen" : ""}`}
                        key={p.id}
                        disabled={!ready || started}
                        onClick={() => choosePack(p.id)}
                        aria-pressed={pack === p.id}
                      >
                        <span>
                          <strong>{p.label}</strong>
                          <small>
                            {ready
                              ? "Paquete completo · sin cargos adicionales"
                              : "Grupo completo no disponible"}
                          </small>
                        </span>
                        <strong>
                          {money(price)}
                          <span> MXN</span>
                        </strong>
                        {pack === p.id ? (
                          <Check size={20} />
                        ) : (
                          <ArrowUpRight size={20} />
                        )}
                      </button>
                    ) : null;
                  })}
                </div>
              ) : (
                <p className="individual-price">
                  {money(
                    (group === "A"
                      ? match.prices.individualA
                      : match.prices.individualB) || 0,
                  )}{" "}
                  MXN por asiento. Toca los lugares disponibles.
                </p>
              )}
            </article>
          ))}
        </div>
        <aside className="purchase-summary">
          <span className="eyebrow">TU PRÓXIMO PLAN</span>
          <h3>
            {selected.length
              ? `${selected.length} ${selected.length === 1 ? "lugar" : "lugares"}`
              : "La tribuna te espera."}
          </h3>
          <p>
            {pack
              ? PACKAGES.find((p) => p.id === pack)?.label
              : mode === "individual"
                ? "Selecciona los asientos en el esquema."
                : "Elige uno de los paquetes disponibles."}
          </p>
          {selected.length > 0 && (
            <ul className="selected-seats">
              {selected.map((id) => {
                const seat = SEATS.find((s) => s.id === id)!;
                return (
                  <li key={id}>
                    <Ticket size={14} />
                    T1-{seat.group === "A" ? "04" : "24"} · {seat.row}-
                    {seat.number}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="summary-price">
            <span>Total del plan</span>
            <strong>
              {total ? money(total) : "—"} <small>MXN</small>
            </strong>
            <small>Sin cargos adicionales</small>
          </div>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          {selected.length > 0 && !selectionValid && (
            <p className="form-error" role="alert">
              La disponibilidad cambió. Elige otros lugares.
            </p>
          )}
          {started && <p className="form-error">Este partido ya comenzó.</p>}
          <button
            className="button button-red full"
            disabled={!selectionValid || busy || started}
            onClick={contact}
          >
            <MessageCircle size={18} />
            {busy ? "Preparando mensaje…" : "Consultar por WhatsApp"}
            <ArrowUpRight size={16} />
          </button>
          <p className="small-note">
            <ShieldCheck size={14} /> Te confirmamos el apartado por WhatsApp.
            Elegir lugares en esta página no los reserva.
          </p>
          <div className="summary-help">
            <span>¿Todavía tienes dudas?</span>
            <WhatsAppLink phone={s.settings.phone} className="text-link">
              Platiquemos
            </WhatsAppLink>
          </div>
        </aside>
      </section>
      <Process holdMinutes={s.settings.holdMinutes} />
      {chat && (
        <Modal
          title={
            chat.demo
              ? "Mensaje de demostración"
              : "Tu plan está listo para conversar"
          }
          onClose={() => setChat(null)}
        >
          <p>
            Revisa la selección y envía el mensaje para que podamos confirmar
            disponibilidad.
          </p>
          <pre className="message-preview">{chat.text}</pre>
          <a
            className="button button-red full"
            href={chat.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle size={18} />
            Abrir WhatsApp{chat.demo ? " · prueba" : ""}
            <ArrowUpRight size={16} />
          </a>
          <p className="small-note">
            Se abrirá WhatsApp o WhatsApp Web. Tú decides cuándo enviar el
            mensaje.
          </p>
        </Modal>
      )}
    </>
  );
}
