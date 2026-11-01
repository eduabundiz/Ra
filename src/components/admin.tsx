"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  ArrowUpRight,
  LogOut,
  CalendarDays,
  Ticket,
  MessageCircle,
  ImagePlus,
  Settings2,
  Users,
  Download,
  Upload,
  Check,
  RefreshCw,
  Eye,
  AlertCircle,
} from "lucide-react";
import { Modal, Brand, SeatDiagram } from "./public";
import {
  PACKAGES,
  money,
  matchDate,
  matchTime,
  availability,
  quote,
  type State,
  type Match,
  type Prices,
  type Reservation,
  type Inquiry,
  type Settings,
} from "@/lib/domain";
import type { Admin } from "@/lib/auth";
type AdminState = State & {
  admin: Admin;
  admins: { user_id: string; email: string; role: string; active: boolean }[];
  demo: boolean;
  integration: { configured: boolean; mode: string };
};
async function call(url: string, body?: unknown) {
  const r = await fetch("/api/" + url, {
    method: body === undefined ? "GET" : "POST",
    headers:
      body instanceof FormData
        ? undefined
        : { "Content-Type": "application/json" },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "No se pudo completar la operación.");
  return d;
}
export function LoginForm({
  demo = false,
  passwordMode = false,
}: {
  demo?: boolean;
  passwordMode?: boolean;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      await call(
        passwordMode ? "admin/password" : "login",
        passwordMode
          ? { password: f.get("password") }
          : { email: f.get("email"), password: f.get("password") },
      );
      router.push("/admin");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="login-form" onSubmit={submit}>
      {!passwordMode && (
        <label>
          Correo electrónico
          <input
            type="email"
            name="email"
            required
            autoComplete="username"
            defaultValue={demo ? "demo@relampamigos.local" : ""}
          />
        </label>
      )}
      <label>
        {passwordMode
          ? "Nueva contraseña (mínimo 12 caracteres)"
          : "Contraseña"}
        <input
          type="password"
          name="password"
          required
          minLength={passwordMode ? 12 : 1}
          autoComplete={passwordMode ? "new-password" : "current-password"}
        />
      </label>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button className="button button-red full" disabled={busy}>
        {busy
          ? "Un momento…"
          : passwordMode
            ? "Guardar contraseña"
            : "Entrar al panel"}
        <ArrowUpRight size={17} />
      </button>
      {demo && (
        <p className="small-note">
          La contraseña local se genera con <code>npm run setup:demo</code> y se
          guarda en tu archivo .env.local.
        </p>
      )}
    </form>
  );
}
const tabs = [
  ["matches", "Partidos", CalendarDays],
  ["reservations", "Apartados", Ticket],
  ["inquiries", "Consultas", MessageCircle],
  ["media", "Fotografías", ImagePlus],
  ["settings", "Configuración", Settings2],
  ["team", "Equipo", Users],
] as const;
export function Dashboard({ initial }: { initial: AdminState }) {
  const [s, setS] = useState(initial),
    [tab, setTab] = useState("matches"),
    [edit, setEdit] = useState<Match | null | undefined>(),
    [reserve, setReserve] = useState<{
      matchId?: string;
      inquiry?: Inquiry;
    } | null>(null),
    [manage, setManage] = useState<Reservation | null>(null),
    [importing, setImporting] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  async function refresh() {
    setS(await call("admin/state"));
  }
  async function perform(
    fn: () => Promise<unknown>,
    message = "Cambios guardados.",
  ) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      await refresh();
      setNotice(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const active = s.reservations.filter((r) => r.status === "reserved");
  const pending = s.inquiries.filter((i) => i.contacted);
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <Brand />
        <div>
          <span>{s.admin.email}</span>
          <Link className="button button-outline" href="/" target="_blank">
            Ver sitio <Eye size={16} />
          </Link>
          <button
            className="icon-button"
            aria-label="Cerrar sesión"
            onClick={() =>
              perform(async () => {
                await call("logout", {});
                router.push("/admin/login");
                router.refresh();
              }, "Sesión cerrada.")
            }
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>
      {s.demo && (
        <div className="admin-demo">
          <AlertCircle size={16} /> DEMOSTRACIÓN LOCAL · Datos de muestra
          editables · Los avisos de WhatsApp se simulan.
        </div>
      )}
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <span className="eyebrow">LA TRIBUNA, EN ORDEN</span>
          <nav aria-label="Panel administrativo">
            {tabs.map(([id, label, Icon]) => (
              <button
                key={id}
                aria-label={label}
                aria-current={tab === id ? "page" : undefined}
                onClick={() => {
                  setTab(id);
                  setNotice("");
                  setError("");
                }}
              >
                <Icon size={19} />
                {label}
                {id === "reservations" && active.length > 0 && (
                  <small>{active.length}</small>
                )}
              </button>
            ))}
          </nav>
          <div className="integration-card">
            <span
              className={`live-dot ${s.integration.mode === "live" ? "" : "muted"}`}
            />
            <strong>
              {s.integration.mode === "live"
                ? "WhatsApp conectado"
                : "Cloud API pendiente"}
            </strong>
            <p>
              {s.demo
                ? "Puedes probar el flujo sin enviar mensajes reales."
                : "Completa la conexión de Meta para recibir consultas y enviar avisos."}
            </p>
          </div>
        </aside>
        <main id="main" className="admin-main">
          <div className="admin-title">
            <div>
              <span className="eyebrow">CHIVABONOS RELAMPAMIGOS</span>
              <h1>{tabs.find((t) => t[0] === tab)?.[1]}</h1>
            </div>
            <button
              className="text-link"
              disabled={busy}
              onClick={() => perform(refresh, "Vista actualizada.")}
            >
              <RefreshCw size={15} />
              Actualizar
            </button>
          </div>
          {notice && (
            <p role="status" className="form-success">
              <Check size={17} />
              {notice}
            </p>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          {tab === "matches" && (
            <>
              <div className="admin-toolbar">
                <p>
                  {s.matches.length} partidos · {active.length} apartados
                  activos
                </p>
                <div>
                  <button
                    className="button button-outline"
                    onClick={() => setImporting(true)}
                  >
                    <Upload size={16} />
                    Cargar Excel
                  </button>
                  <button
                    className="button button-red"
                    onClick={() => setEdit(null)}
                  >
                    <Plus size={16} />
                    Nuevo partido
                  </button>
                </div>
              </div>
              <div className="admin-match-list">
                {[...s.matches]
                  .sort((a, b) => a.kickoff.localeCompare(b.kickoff))
                  .map((m) => {
                    const inv = s.inventory.filter((i) => i.matchId === m.id);
                    const st = availability(inv);
                    return (
                      <article key={m.id} className="admin-match">
                        <div className="admin-match-date">
                          <strong>
                            {new Intl.DateTimeFormat("es-MX", {
                              day: "2-digit",
                              timeZone: "America/Mexico_City",
                            }).format(new Date(m.kickoff))}
                          </strong>
                          <span>
                            {new Intl.DateTimeFormat("es-MX", {
                              month: "short",
                              timeZone: "America/Mexico_City",
                            }).format(new Date(m.kickoff))}
                          </span>
                        </div>
                        <div>
                          <span className="eyebrow">
                            {m.published ? "PUBLICADO" : "BORRADOR"}
                            {m.demo ? " · MUESTRA" : ""}
                          </span>
                          <h3>Guadalajara vs {m.opponent}</h3>
                          <p>
                            {m.competition} · {matchTime(m.kickoff)} ·{" "}
                            {st.available}/10 libres
                          </p>
                        </div>
                        <div className="admin-match-actions">
                          <button
                            className="button button-outline"
                            onClick={() => setEdit(m)}
                          >
                            Editar
                          </button>
                          <button
                            className="button button-dark"
                            onClick={() => setReserve({ matchId: m.id })}
                          >
                            Apartar
                          </button>
                          {m.published && (
                            <Link
                              className="icon-button"
                              aria-label={`Abrir ${m.opponent}`}
                              target="_blank"
                              href={`/partidos/${m.slug}`}
                            >
                              <ArrowUpRight size={20} />
                            </Link>
                          )}
                        </div>
                      </article>
                    );
                  })}
                {!s.matches.length && (
                  <div className="admin-empty">
                    <CalendarDays />
                    <h3>Agrega el primer partido.</h3>
                    <p>Puedes capturarlo o importar la plantilla de Excel.</p>
                  </div>
                )}
              </div>
            </>
          )}
          {tab === "reservations" && (
            <>
              <div className="admin-toolbar">
                <p>
                  Los apartados no se liberan automáticamente. Revisa los plazos
                  con el cliente.
                </p>
                <button
                  className="button button-red"
                  onClick={() => setReserve({})}
                >
                  <Plus size={16} />
                  Nuevo apartado
                </button>
              </div>
              <div className="reservation-grid">
                {s.reservations.map((r) => {
                  const m = s.matches.find((m) => m.id === r.matchId);
                  return (
                    <article className="reservation-card" key={r.id}>
                      <div>
                        <span
                          className={`status status-${r.status === "reserved" ? "reserved" : r.status === "sold" ? "sold" : "available"}`}
                        >
                          {r.status === "reserved"
                            ? "Reservado"
                            : r.status === "sold"
                              ? "Vendido"
                              : "Liberado"}
                        </span>
                        <span className="small-label">#{r.id.slice(0, 8)}</span>
                      </div>
                      <h3>
                        {r.customerName || "Cliente sin nombre registrado"}
                      </h3>
                      <p>Guadalajara vs {m?.opponent}</p>
                      <strong>{r.seatIds.join(" · ")}</strong>
                      <p>
                        {money(r.total)} MXN ·{" "}
                        {r.customerPhone || "Sin teléfono"}
                      </p>
                      {r.status === "reserved" && (
                        <p
                          className={
                            new Date(r.reviewAt) < new Date()
                              ? "deadline overdue"
                              : "deadline"
                          }
                        >
                          Revisar apartado: {matchTime(r.reviewAt)} ·{" "}
                          {matchDate(r.reviewAt)}
                        </p>
                      )}
                      <p className="small-note">
                        Pago: {r.paymentConfirmed ? "verificado" : "pendiente"}{" "}
                        · Transferencia:{" "}
                        {r.deliveryStatus === "completed"
                          ? "completada"
                          : r.deliveryStatus === "sent"
                            ? "enviada"
                            : "pendiente"}
                      </p>
                      {r.status !== "released" && (
                        <button
                          className="button button-outline full"
                          onClick={() => setManage(r)}
                        >
                          Gestionar apartado <ArrowUpRight size={16} />
                        </button>
                      )}
                    </article>
                  );
                })}
                {!s.reservations.length && (
                  <div className="admin-empty">
                    <Ticket />
                    <h3>Aún no hay apartados.</h3>
                    <p>Cuando acuerden uno por WhatsApp, regístralo aquí.</p>
                  </div>
                )}
              </div>
            </>
          )}
          {tab === "inquiries" && (
            <>
              <p className="admin-intro">
                La referencia une la selección de la web con el mensaje
                recibido. Consultar no bloquea lugares.
              </p>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Referencia</th>
                      <th>Partido / lugares</th>
                      <th>Contacto</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.inquiries.map((i) => (
                      <tr key={i.id}>
                        <td>
                          <strong>{i.code}</strong>
                          <small>
                            {i.contacted
                              ? "Mensaje recibido"
                              : "Esperando mensaje"}
                          </small>
                        </td>
                        <td>
                          {s.matches.find((m) => m.id === i.matchId)?.opponent}
                          <small>
                            {i.seatIds.join(", ")} · {money(i.total)}
                          </small>
                        </td>
                        <td>{i.customerPhone || "Aún sin identificar"}</td>
                        <td>
                          {i.contacted ? (
                            <button
                              className="button button-outline"
                              onClick={() =>
                                setReserve({ matchId: i.matchId, inquiry: i })
                              }
                            >
                              Apartar
                            </button>
                          ) : s.demo ? (
                            <button
                              className="text-link"
                              onClick={() =>
                                perform(
                                  () =>
                                    call("admin/demo-contact", { id: i.id }),
                                  "Mensaje simulado recibido. Ahora puedes apartar.",
                                )
                              }
                            >
                              Simular mensaje recibido
                            </button>
                          ) : (
                            <span className="small-note">
                              Se identifica al llegar a Cloud API.
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!s.inquiries.length && (
                  <div className="admin-empty">
                    <MessageCircle />
                    <h3>La próxima consulta empieza en la web.</h3>
                    <p>
                      Selecciona un grupo en un partido y prepara el mensaje
                      para probar el flujo.
                    </p>
                  </div>
                )}
              </div>
              <div className="outbox-panel">
                <div>
                  <h3>Avisos de WhatsApp</h3>
                  <button
                    className="text-link"
                    onClick={() =>
                      perform(
                        () => call("admin/dispatch", {}),
                        s.demo
                          ? "Avisos simulados. No se envió ningún mensaje."
                          : "Cola procesada. Revisa el resultado de cada aviso.",
                      )
                    }
                  >
                    Procesar avisos <RefreshCw size={14} />
                  </button>
                </div>
                <p className="small-note">
                  {pending.length} consultas recibidas. Los envíos fuera de la
                  ventana de servicio requieren una plantilla aprobada.
                </p>
                {s.outbox.map((o) => (
                  <div className="outbox-item" key={o.id}>
                    <strong>{o.phone}</strong>
                    <span>
                      {o.status === "simulated"
                        ? "Simulado"
                        : o.status === "sent"
                          ? "Enviado"
                          : o.status === "review"
                            ? "Requiere revisión"
                            : "Pendiente"}
                    </span>
                    <p>{o.text}</p>
                    {o.error && <small className="form-error">{o.error}</small>}
                  </div>
                ))}
              </div>
            </>
          )}
          {tab === "media" && (
            <MediaPanel s={s} perform={perform} busy={busy} />
          )}
          {tab === "settings" && (
            <SettingsForm settings={s.settings} perform={perform} busy={busy} />
          )}
          {tab === "team" && (
            <div>
              <p className="admin-intro">
                Cada administrador entra con su propia cuenta. Los propietarios
                también pueden gestionar el acceso del equipo.
              </p>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Correo</th>
                      <th>Rol</th>
                      <th>Estado</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {s.admins.map((a) => (
                      <tr key={a.user_id}>
                        <td>{a.email}</td>
                        <td>{a.role === "owner" ? "Propietario" : "Editor"}</td>
                        <td>{a.active ? "Activo" : "Desactivado"}</td>
                        <td>
                          {s.admin.role === "owner" &&
                            !s.demo &&
                            a.active &&
                            a.user_id !== s.admin.id && (
                              <button
                                className="text-link"
                                onClick={() => {
                                  if (
                                    confirm(
                                      "¿Desactivar el acceso de esta persona?",
                                    )
                                  )
                                    perform(
                                      () =>
                                        call("admin/deactivate", {
                                          id: a.user_id,
                                        }),
                                      "Acceso desactivado.",
                                    );
                                }}
                              >
                                Desactivar
                              </button>
                            )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {s.demo ? (
                <p className="setup-note">
                  La demostración tiene una cuenta local. La invitación de
                  usuarios individuales se habilita con Supabase Auth.
                </p>
              ) : (
                s.admin.role === "owner" && (
                  <form
                    className="admin-form invite-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      perform(
                        () =>
                          call("admin/invite", {
                            email: f.get("email"),
                            role: f.get("role"),
                          }),
                        "Invitación enviada.",
                      );
                    }}
                  >
                    <h3>Invitar administrador</h3>
                    <label>
                      Correo
                      <input name="email" type="email" required />
                    </label>
                    <label>
                      Permisos
                      <select name="role">
                        <option value="editor">
                          Editor: partidos, reservas y fotografías
                        </option>
                        <option value="owner">
                          Propietario: también gestiona administradores
                        </option>
                      </select>
                    </label>
                    <button className="button button-red" disabled={busy}>
                      Enviar invitación
                    </button>
                  </form>
                )
              )}
            </div>
          )}
        </main>
      </div>
      {edit !== undefined && (
        <MatchEditor
          match={edit}
          media={s.media}
          onClose={() => setEdit(undefined)}
          onSave={async (m) => {
            await call("admin/save-match", m);
            await refresh();
            setEdit(undefined);
            setNotice("Partido guardado.");
          }}
        />
      )}
      {reserve && (
        <ReservationEditor
          s={s}
          selection={reserve}
          onClose={() => setReserve(null)}
          onSave={async (v) => {
            await call("admin/transition", v);
            await refresh();
            setReserve(null);
            setNotice("Apartado registrado. La disponibilidad se actualizó.");
          }}
        />
      )}
      {manage && (
        <ManageReservation
          reservation={s.reservations.find((r) => r.id === manage.id) || manage}
          onClose={() => setManage(null)}
          onAction={async (data) => {
            await call("admin/transition", data);
            await refresh();
            setManage(null);
            setNotice("Apartado actualizado.");
          }}
        />
      )}
      {importing && (
        <ImportModal
          onClose={() => setImporting(false)}
          onSaved={async () => {
            await refresh();
            setImporting(false);
            setNotice(
              "Partidos importados como borradores. Revisa y publica cada uno.",
            );
          }}
        />
      )}
    </div>
  );
}
function priceInputs(prices: Prices) {
  return Object.fromEntries(
    Object.entries(prices).map(([k, v]) => [k, v ? String(v / 100) : ""]),
  ) as Record<keyof Prices, string>;
}
function MatchEditor({
  match,
  media,
  onClose,
  onSave,
}: {
  match: Match | null;
  media: State["media"];
  onClose: () => void;
  onSave: (m: Match) => Promise<void>;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [individual, setIndividual] = useState(match?.allowIndividual || false);
  const [prices, setPrices] = useState(
    priceInputs(
      match?.prices || {
        A5: null,
        B5: null,
        B3: null,
        B2: null,
        individualA: null,
        individualB: null,
      },
    ),
  );
  const labels = {
    A5: "Poniente · 5 juntos",
    B5: "Oriente · 5 (3 + 2)",
    B3: "Oriente · 3 (fila R)",
    B2: "Oriente · 2 (fila Q)",
    individualA: "Individual Poniente",
    individualB: "Individual Oriente",
  };
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const p = Object.fromEntries(
        Object.entries(prices).map(([k, v]) => {
          if (v && !/^\d+(\.\d{1,2})?$/.test(v))
            throw new Error(
              "Escribe precios positivos, con hasta dos decimales.",
            );
          return [k, v ? Math.round(Number(v) * 100) : null];
        }),
      ) as Prices;
      const kickoff = new Date(
        String(f.get("kickoff")) + ":00-06:00",
      ).toISOString();
      await onSave({
        id: match?.id || crypto.randomUUID(),
        slug: String(f.get("slug")),
        opponent: String(f.get("opponent")),
        competition: String(f.get("competition")),
        stadium: String(f.get("stadium")),
        kickoff,
        published: f.get("published") === "on",
        allowIndividual: individual,
        prices: p,
        version: match?.version || 0,
        ...(match?.demo ? { demo: true } : {}),
        ...(f.get("opponentLogoId")
          ? { opponentLogoId: String(f.get("opponentLogoId")) }
          : {}),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={match ? "Editar partido" : "Nuevo partido"} onClose={onClose}>
      <form className="admin-form" onSubmit={submit}>
        <div className="form-grid">
          <label>
            Rival
            <input
              name="opponent"
              defaultValue={match?.opponent}
              required
              maxLength={80}
            />
          </label>
          <label>
            Competencia
            <input
              name="competition"
              defaultValue={match?.competition || "Liga MX"}
              required
            />
          </label>
          <label>
            Fecha y hora de Guadalajara
            <input
              type="datetime-local"
              name="kickoff"
              defaultValue={
                match
                  ? new Date(new Date(match.kickoff).getTime() - 6 * 3600000)
                      .toISOString()
                      .slice(0, 16)
                  : ""
              }
              required
            />
          </label>
          <label>
            Estadio
            <input
              name="stadium"
              defaultValue={match?.stadium || "Estadio Akron"}
              required
            />
          </label>
          <label>
            Clave para la URL
            <input
              name="slug"
              defaultValue={match?.slug}
              placeholder="partido-clave"
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
            />
          </label>
          <label>
            Emblema del rival
            <select
              name="opponentLogoId"
              defaultValue={match?.opponentLogoId || ""}
            >
              <option value="">Usar iniciales</option>
              {media
                .filter((m) => m.published && m.kind === "logo")
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <h3>Precios en MXN · por paquete completo</h3>
        <p className="small-note">
          El total incluye todo. Deja vacío un paquete para no ofrecerlo. Los
          precios se guardan con precisión de centavos.
        </p>
        <div className="form-grid">
          {Object.entries(labels).map(([key, label]) => (
            <label key={key}>
              {label}
              <div className="currency-input">
                <span>$</span>
                <input
                  inputMode="decimal"
                  value={prices[key as keyof Prices]}
                  onChange={(e) =>
                    setPrices({ ...prices, [key]: e.target.value })
                  }
                  placeholder="Sin ofrecer"
                  aria-label={label}
                />
              </div>
            </label>
          ))}
        </div>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={individual}
            onChange={(e) => setIndividual(e.target.checked)}
          />
          Permitir selección individual en este partido
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            name="published"
            defaultChecked={match?.published}
          />
          Publicar en la página
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button button-red full" disabled={busy}>
          {busy ? "Guardando…" : "Guardar partido"}
        </button>
      </form>
    </Modal>
  );
}
function ReservationEditor({
  s,
  selection,
  onClose,
  onSave,
}: {
  s: AdminState;
  selection: { matchId?: string; inquiry?: Inquiry };
  onClose: () => void;
  onSave: (data: unknown) => Promise<void>;
}) {
  const iq = selection.inquiry;
  const [matchId, setMatchId] = useState(
    selection.matchId || s.matches[0]?.id || "",
  );
  const initialPack = iq?.packageId;
  const [pack, setPack] = useState<string | undefined>(initialPack),
    [seats, setSeats] = useState<string[]>(iq?.seatIds || []),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const match = s.matches.find((m) => m.id === matchId);
  const inventory = s.inventory.filter((i) => i.matchId === matchId);
  let total = 0;
  try {
    if (match && seats.length) total = quote(match, seats, pack);
  } catch {}
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await onSave({
        action: "reserve",
        matchId,
        seatIds: seats,
        packageId: pack,
        customerName: f.get("name"),
        customerPhone: f.get("phone"),
        notes: f.get("notes"),
        lastInboundAt: iq?.lastInboundAt,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Registrar apartado acordado" onClose={onClose}>
      <form className="admin-form" onSubmit={submit}>
        <label>
          Partido
          <select
            value={matchId}
            onChange={(e) => {
              setMatchId(e.target.value);
              setSeats([]);
              setPack(undefined);
            }}
          >
            {s.matches.map((m) => (
              <option key={m.id} value={m.id}>
                {m.opponent} · {matchDate(m.kickoff)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Paquete
          <select
            value={pack || ""}
            onChange={(e) => {
              const p = PACKAGES.find((p) => p.id === e.target.value);
              setPack(p?.id);
              setSeats(p ? [...p.seatIds] : []);
            }}
          >
            <option value="">
              {match?.allowIndividual
                ? "Selecciona paquete o asientos individuales"
                : "Selecciona un paquete"}
            </option>
            {PACKAGES.filter(
              (p) =>
                match?.prices[p.id] &&
                p.seatIds.every((id) =>
                  inventory.some(
                    (i) => i.seatId === id && i.status === "available",
                  ),
                ),
            ).map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} · {money(match!.prices[p.id]!)}
              </option>
            ))}
          </select>
        </label>
        <div className="admin-seat-grids">
          {(["A", "B"] as const).map((g) => (
            <SeatDiagram
              key={g}
              group={g}
              inventory={inventory}
              selected={seats}
              onSelect={
                !pack && match?.allowIndividual
                  ? (id) =>
                      setSeats((prev) =>
                        prev.includes(id)
                          ? prev.filter((s) => s !== id)
                          : [...prev, id],
                      )
                  : undefined
              }
            />
          ))}
        </div>
        <div className="form-grid">
          <label>
            Nombre del cliente
            <input name="name" maxLength={100} />
          </label>
          <label>
            WhatsApp del cliente
            <input
              name="phone"
              defaultValue={iq?.customerPhone || ""}
              placeholder="52 + 10 dígitos"
              pattern="[0-9]{10,15}"
            />
          </label>
        </div>
        <label>
          Notas privadas
          <textarea name="notes" rows={2} maxLength={1000} />
        </label>
        <p>
          Total acordado: <strong>{money(total)} MXN</strong>
        </p>
        <p className="small-note">
          El apartado debe estar acordado con el cliente. El panel señalará
          cuándo revisar el plazo; se libera manualmente.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="button button-red full"
          disabled={busy || !seats.length || !total}
        >
          {busy ? "Apartando…" : "Confirmar apartado"}
        </button>
      </form>
    </Modal>
  );
}
function ManageReservation({
  reservation: r,
  onClose,
  onAction,
}: {
  reservation: Reservation;
  onClose: () => void;
  onAction: (data: unknown) => Promise<void>;
}) {
  const [payment, setPayment] = useState(r.paymentConfirmed),
    [delivery, setDelivery] = useState(r.deliveryStatus),
    [notes, setNotes] = useState(r.notes),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function act(action: string) {
    setBusy(true);
    setError("");
    try {
      await onAction({
        action,
        reservationId: r.id,
        matchId: r.matchId,
        expectedVersion: r.version,
        ...(action === "delivery"
          ? { paymentConfirmed: payment, deliveryStatus: delivery, notes }
          : {}),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={`Apartado #${r.id.slice(0, 8)}`} onClose={onClose}>
      <div className="admin-form">
        <p>
          <strong>{r.customerName || "Cliente"}</strong> ·{" "}
          {r.seatIds.join(", ")}
          <br />
          {money(r.total)} MXN
        </p>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={payment}
            onChange={(e) => setPayment(e.target.checked)}
            disabled={r.status === "sold"}
          />
          Pago recibido y verificado por nosotros
        </label>
        <label>
          Transferencia por Boletomóvil
          <select
            value={delivery}
            disabled={r.status === "sold"}
            onChange={(e) =>
              setDelivery(e.target.value as Reservation["deliveryStatus"])
            }
          >
            <option value="pending">Pendiente</option>
            <option value="sent">Enviada, esperando verificación</option>
            <option value="completed">
              Completada y verificada con el comprador
            </option>
          </select>
        </label>
        <label>
          Notas privadas
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="button button-dark full"
          disabled={busy}
          onClick={() => act("delivery")}
        >
          Guardar pago, entrega y notas
        </button>
        {r.status === "reserved" && (
          <>
            <button
              className="button button-red full"
              disabled={
                busy || !r.paymentConfirmed || r.deliveryStatus !== "completed"
              }
              onClick={() => act("sell")}
            >
              Confirmar venta cerrada
            </button>
            <p className="small-note">
              Para cerrar la venta, guarda primero el pago verificado y la
              transferencia completada.
            </p>
            <button
              className="text-link danger"
              disabled={busy}
              onClick={() => {
                if (
                  confirm("¿Liberar estos asientos para volver a ofrecerlos?")
                )
                  act("release");
              }}
            >
              Liberar apartado
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
function ImportModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [preview, setPreview] = useState<{
      matches: Match[];
      errors: string[];
    } | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal title="Importar partidos desde Excel" onClose={onClose}>
      <p>
        Descarga la plantilla, agrega información confirmada y revisa la vista
        previa. Los partidos nuevos se crean como borradores.
      </p>
      <a className="button button-outline" href="/api/admin/template" download>
        <Download size={16} />
        Descargar plantilla .xlsx
      </a>
      <form
        className="admin-form import-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            setPreview(
              await call("admin/import-preview", new FormData(e.currentTarget)),
            );
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Archivo .xlsx · máximo 2 MB
          <input
            type="file"
            name="file"
            accept=".xlsx"
            required
            onChange={() => setPreview(null)}
          />
        </label>
        <button className="button button-dark" disabled={busy}>
          <Eye size={16} />
          Revisar archivo
        </button>
      </form>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {preview && (
        <div className="import-preview">
          {preview.errors.map((e) => (
            <p className="form-error" key={e}>
              {e}
            </p>
          ))}
          <h3>{preview.matches.length} partidos encontrados</h3>
          {preview.matches.map((m) => (
            <p key={m.id}>
              <strong>{m.opponent}</strong> · {matchDate(m.kickoff)} ·{" "}
              {matchTime(m.kickoff)}
              <small> {m.slug} · Borrador</small>
            </p>
          ))}
          <button
            className="button button-red full"
            disabled={
              busy || !!preview.errors.length || !preview.matches.length
            }
            onClick={async () => {
              setBusy(true);
              try {
                await call("admin/import", preview.matches);
                await onSaved();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Importar {preview.matches.length} borradores
          </button>
        </div>
      )}
    </Modal>
  );
}
type Perform = (fn: () => Promise<unknown>, message?: string) => Promise<void>;
function MediaPanel({
  s,
  perform,
  busy,
}: {
  s: AdminState;
  perform: Perform;
  busy: boolean;
}) {
  const [reviewed, setReviewed] = useState<Record<string, boolean>>({});
  return (
    <>
      <p className="admin-intro">
        Las fotografías se cargan como borradores. Revisa cada una antes de
        hacerla pública. Nunca publiques QR, códigos de boletos, cuentas ni
        información de compradores.
      </p>
      <form
        className="admin-form upload-form"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          perform(async () => {
            await call("admin/upload", new FormData(form));
            form.reset();
          }, "Fotografía cargada como borrador. Revisa la imagen antes de publicarla.");
        }}
      >
        <div className="form-grid">
          <label>
            Descripción pública
            <input name="title" required minLength={3} maxLength={150} />
          </label>
          <label>
            Tipo de imagen
            <select name="kind">
              <option value="photo">Fotografía de lugares / estadio</option>
              <option value="evidence">Evidencia sanitizada</option>
              <option value="logo">Emblema de equipo autorizado</option>
            </select>
          </label>
          <label>
            Ubicación
            <select name="group">
              <option value="all">General / estadio</option>
              <option value="A">Grupo A · Poniente</option>
              <option value="B">Grupo B · Oriente</option>
            </select>
          </label>
        </div>
        <label>
          JPG, PNG o WebP · hasta 8 MB
          <input
            name="file"
            type="file"
            required
            accept="image/jpeg,image/png,image/webp"
          />
        </label>
        <button className="button button-red" disabled={busy}>
          <Upload size={16} />
          Subir para revisar
        </button>
        <p className="small-note">
          Se elimina metadata y se normaliza el formato. El contenido visible y
          la presencia de códigos requieren revisión humana.
        </p>
      </form>
      <div className="admin-media-grid">
        {s.media.map((m) => (
          <article key={m.id}>
            <img src={`/api/media/${m.id}`} alt={m.title} />
            <div>
              <span className="eyebrow">
                {m.published ? "PUBLICADA" : "BORRADOR"} ·{" "}
                {m.group === "all" ? "GENERAL" : `GRUPO ${m.group}`}
              </span>
              <h3>{m.title}</h3>
              <div className="media-order">
                <button
                  className="text-link"
                  disabled={busy || s.media[0]?.id === m.id}
                  onClick={() =>
                    perform(() =>
                      call("admin/reorder-media", {
                        id: m.id,
                        direction: "up",
                      }),
                    )
                  }
                >
                  Subir orden ↑
                </button>
                <button
                  className="text-link"
                  disabled={busy || s.media.at(-1)?.id === m.id}
                  onClick={() =>
                    perform(() =>
                      call("admin/reorder-media", {
                        id: m.id,
                        direction: "down",
                      }),
                    )
                  }
                >
                  Bajar orden ↓
                </button>
              </div>
              {!m.published && (
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={!!reviewed[m.id]}
                    onChange={(e) =>
                      setReviewed({ ...reviewed, [m.id]: e.target.checked })
                    }
                  />
                  Revisé que no contiene información privada ni códigos.
                </label>
              )}
              <button
                className="button button-outline full"
                disabled={busy || (!m.published && !reviewed[m.id])}
                onClick={() =>
                  perform(
                    () =>
                      call("admin/media", {
                        id: m.id,
                        published: !m.published,
                        reviewed: !!reviewed[m.id],
                      }),
                    m.published
                      ? "Fotografía oculta."
                      : "Fotografía publicada.",
                  )
                }
              >
                {m.published ? "Ocultar fotografía" : "Publicar fotografía"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
function SettingsForm({
  settings: s,
  perform,
  busy,
}: {
  settings: Settings;
  perform: Perform;
  busy: boolean;
}) {
  return (
    <form
      className="admin-form settings-form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        perform(() =>
          call("admin/settings", {
            phone: f.get("phone"),
            heroTitle: f.get("heroTitle"),
            heroSubtitle: f.get("heroSubtitle"),
            holdMinutes: Number(f.get("holdMinutes")),
            privacyName: f.get("privacyName"),
            privacyEmail: f.get("privacyEmail"),
            privacyAddress: f.get("privacyAddress"),
          }),
        );
      }}
    >
      <h3>Contacto y portada</h3>
      <div className="form-grid">
        <label>
          WhatsApp internacional
          <input
            name="phone"
            required
            defaultValue={s.phone}
            pattern="[0-9]{10,15}"
          />
        </label>
        <label>
          Revisar apartados después de (minutos)
          <input
            type="number"
            name="holdMinutes"
            required
            min={5}
            max={1440}
            defaultValue={s.holdMinutes}
          />
        </label>
      </div>
      <label>
        Título principal
        <input
          name="heroTitle"
          required
          maxLength={90}
          defaultValue={s.heroTitle}
        />
      </label>
      <label>
        Texto de portada
        <textarea
          name="heroSubtitle"
          required
          maxLength={250}
          defaultValue={s.heroSubtitle}
          rows={3}
        />
      </label>
      <h3>Responsable y privacidad</h3>
      <p className="small-note">
        Completa los datos reales del vendedor antes de publicar comercialmente.
        Estos datos aparecen en el aviso de privacidad.
      </p>
      <label>
        Nombre o razón social del responsable
        <input name="privacyName" defaultValue={s.privacyName} />
      </label>
      <label>
        Correo para privacidad
        <input name="privacyEmail" type="email" defaultValue={s.privacyEmail} />
      </label>
      <label>
        Domicilio del responsable
        <textarea
          name="privacyAddress"
          defaultValue={s.privacyAddress}
          rows={2}
        />
      </label>
      <button className="button button-red" disabled={busy}>
        <Check size={16} />
        Guardar configuración
      </button>
    </form>
  );
}
