import { z } from "zod";

export const SEATS = [
  ...[15, 16, 17, 18, 19].map((n) => ({
    id: `A-S${n}`,
    group: "A" as const,
    row: "S",
    number: n,
    section: "T1-04",
    zone: "Lateral Inferior Poniente",
  })),
  ...[10, 11, 12].map((n) => ({
    id: `B-R${n}`,
    group: "B" as const,
    row: "R",
    number: n,
    section: "T1-24",
    zone: "Lateral Inferior Oriente",
  })),
  ...[13, 14].map((n) => ({
    id: `B-Q${n}`,
    group: "B" as const,
    row: "Q",
    number: n,
    section: "T1-24",
    zone: "Lateral Inferior Oriente",
  })),
];
export const PACKAGES = [
  {
    id: "A5",
    label: "Poniente · 5 juntos",
    group: "A",
    seatIds: SEATS.filter((s) => s.group === "A").map((s) => s.id),
  },
  {
    id: "B5",
    label: "Oriente · 5 lugares (3 + 2)",
    group: "B",
    seatIds: SEATS.filter((s) => s.group === "B").map((s) => s.id),
  },
  {
    id: "B3",
    label: "Oriente · 3 juntos, fila R",
    group: "B",
    seatIds: SEATS.filter((s) => s.row === "R").map((s) => s.id),
  },
  {
    id: "B2",
    label: "Oriente · 2 juntos, fila Q",
    group: "B",
    seatIds: SEATS.filter((s) => s.row === "Q").map((s) => s.id),
  },
] as const;
export type SeatStatus = "available" | "reserved" | "sold";
export type Prices = {
  A5: number | null;
  B5: number | null;
  B3: number | null;
  B2: number | null;
  individualA: number | null;
  individualB: number | null;
};
export type Match = {
  id: string;
  slug: string;
  opponent: string;
  competition: string;
  kickoff: string;
  stadium: string;
  published: boolean;
  allowIndividual: boolean;
  prices: Prices;
  version: number;
  demo?: boolean;
  opponentLogoId?: string;
};
export type Inventory = {
  matchId: string;
  seatId: string;
  status: SeatStatus;
  version: number;
};
export type Reservation = {
  id: string;
  matchId: string;
  seatIds: string[];
  status: "reserved" | "sold" | "released";
  customerName: string;
  customerPhone: string;
  total: number;
  createdAt: string;
  reviewAt: string;
  paymentConfirmed: boolean;
  deliveryStatus: "pending" | "sent" | "completed";
  notes: string;
  version: number;
  lastInboundAt?: string;
};
export type Inquiry = {
  id: string;
  code: string;
  matchId: string;
  seatIds: string[];
  total: number;
  createdAt: string;
  customerPhone?: string;
  lastInboundAt?: string;
  contacted: boolean;
  packageId?: string;
};
export type Media = {
  id: string;
  title: string;
  group: "A" | "B" | "all";
  published: boolean;
  file: string;
  createdAt: string;
  position?: number;
  kind?: "photo" | "evidence" | "logo";
};
export type Settings = {
  phone: string;
  heroTitle: string;
  heroSubtitle: string;
  holdMinutes: number;
  privacyName: string;
  privacyEmail: string;
  privacyAddress: string;
};
export type Outbox = {
  id: string;
  eventKey: string;
  phone: string;
  text: string;
  lastInboundAt?: string;
  status: "pending" | "sent" | "review" | "simulated";
  attempts: number;
  createdAt: string;
  error?: string;
  metaId?: string;
};
export type Audit = {
  id: string;
  actor: string;
  action: string;
  at: string;
  details: string;
};
export type State = {
  matches: Match[];
  inventory: Inventory[];
  reservations: Reservation[];
  inquiries: Inquiry[];
  media: Media[];
  settings: Settings;
  outbox: Outbox[];
  audit: Audit[];
};
export const defaultSettings: Settings = {
  phone: "523314581203",
  heroTitle: "El partido se vive juntos.",
  heroSubtitle:
    "Arma el plan. Invita a los tuyos. Vive al Guadalajara desde nuestros lugares en el Akron.",
  holdMinutes: 30,
  privacyName: "",
  privacyEmail: "",
  privacyAddress: "",
};
export const emptyState = (): State => ({
  matches: [],
  inventory: [],
  reservations: [],
  inquiries: [],
  media: [],
  settings: { ...defaultSettings },
  outbox: [],
  audit: [],
});
const price = z.number().int().positive().max(100000000).nullable();
export const matchSchema = z
  .object({
    id: z.uuid(),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .min(3)
      .max(100),
    opponent: z.string().trim().min(2).max(80),
    competition: z.string().trim().min(2).max(80),
    kickoff: z.iso.datetime({ offset: true }),
    stadium: z.string().trim().min(2).max(80).default("Estadio Akron"),
    published: z.boolean(),
    allowIndividual: z.boolean(),
    prices: z.object({
      A5: price,
      B5: price,
      B3: price,
      B2: price,
      individualA: price,
      individualB: price,
    }),
    version: z.number().int().nonnegative(),
    opponentLogoId: z.uuid().optional(),
    demo: z.boolean().optional(),
  })
  .superRefine((m, c) => {
    if (
      m.published &&
      !m.prices.A5 &&
      !m.prices.B5 &&
      !m.prices.B3 &&
      !m.prices.B2
    )
      c.addIssue({
        code: "custom",
        message: "Agrega al menos un precio por grupo para publicar.",
      });
    if (m.allowIndividual && (!m.prices.individualA || !m.prices.individualB))
      c.addIssue({
        code: "custom",
        message:
          "Configura ambos precios individuales antes de habilitar esta modalidad.",
      });
  });
export const settingsSchema = z.object({
  phone: z.string().regex(/^\d{10,15}$/),
  heroTitle: z.string().trim().min(5).max(90),
  heroSubtitle: z.string().trim().min(10).max(250),
  holdMinutes: z.number().int().min(5).max(1440),
  privacyName: z.string().max(150),
  privacyEmail: z.union([z.email(), z.literal("")]),
  privacyAddress: z.string().max(300),
});
export const money = (cents: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100);
export function matchDate(iso: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Mexico_City",
  }).format(new Date(iso));
}
export function matchTime(iso: string) {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Mexico_City",
    hour12: true,
  }).format(new Date(iso));
}
export function availability(inv: Inventory[]) {
  const available = inv.filter((i) => i.status === "available").length;
  return {
    available,
    label:
      available === 10
        ? "Disponible"
        : available > 0
          ? "Disponibilidad parcial"
          : inv.some((i) => i.status === "reserved")
            ? "Reservado"
            : "Vendido",
  };
}
export function quote(
  match: Match,
  seatIds: string[],
  packageId?: string,
): number {
  const unique = [...new Set(seatIds)];
  if (
    !unique.length ||
    unique.length !== seatIds.length ||
    unique.some((id) => !SEATS.some((s) => s.id === id))
  )
    throw new Error("Selección de asientos inválida.");
  if (packageId) {
    const pack = PACKAGES.find((p) => p.id === packageId);
    if (
      !pack ||
      pack.seatIds.length !== unique.length ||
      !pack.seatIds.every((id) => unique.includes(id))
    )
      throw new Error("El grupo no coincide con los asientos.");
    const p = match.prices[pack.id];
    if (!p) throw new Error("Este grupo aún no tiene precio.");
    return p;
  }
  if (!match.allowIndividual)
    throw new Error(
      "La venta individual está deshabilitada para este partido.",
    );
  return unique.reduce((sum, id) => {
    const seat = SEATS.find((s) => s.id === id)!;
    const p =
      seat.group === "A" ? match.prices.individualA : match.prices.individualB;
    if (!p) throw new Error("Precio individual no disponible.");
    return sum + p;
  }, 0);
}
export type Transition = {
  action: "reserve" | "release" | "sell" | "delivery";
  matchId: string;
  seatIds?: string[];
  packageId?: string;
  reservationId?: string;
  expectedVersion?: number;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  deliveryStatus?: Reservation["deliveryStatus"];
  paymentConfirmed?: boolean;
  lastInboundAt?: string;
};
export function applyTransition(
  state: State,
  t: Transition,
  actor: string,
  now = new Date(),
): Reservation {
  const match = state.matches.find((m) => m.id === t.matchId);
  if (!match) throw new Error("Partido no encontrado.");
  let r: Reservation;
  if (t.action === "reserve") {
    if (new Date(match.kickoff) <= now)
      throw new Error("Este partido ya comenzó.");
    const seats = t.seatIds ?? [];
    const total = quote(match, seats, t.packageId);
    if (
      seats.some(
        (id) =>
          !state.inventory.some(
            (i) =>
              i.matchId === match.id &&
              i.seatId === id &&
              i.status === "available",
          ),
      )
    )
      throw new Error(
        "Uno o más asientos ya no están disponibles. Actualiza la selección.",
      );
    const phone = t.customerPhone?.trim() ?? "";
    if (phone && !/^\d{10,15}$/.test(phone))
      throw new Error("Usa teléfono internacional, solo dígitos.");
    r = {
      id: crypto.randomUUID(),
      matchId: match.id,
      seatIds: seats,
      status: "reserved",
      customerName: t.customerName?.trim() ?? "",
      customerPhone: phone,
      total,
      createdAt: now.toISOString(),
      reviewAt: new Date(
        now.getTime() + state.settings.holdMinutes * 60000,
      ).toISOString(),
      paymentConfirmed: false,
      deliveryStatus: "pending",
      notes: t.notes ?? "",
      version: 1,
      lastInboundAt: t.lastInboundAt,
    };
    state.reservations.push(r);
    for (const seat of state.inventory.filter(
      (i) => i.matchId === match.id && seats.includes(i.seatId),
    )) {
      seat.status = "reserved";
      seat.version++;
    }
  } else {
    const existing = state.reservations.find(
      (v) => v.id === t.reservationId && v.matchId === match.id,
    );
    if (!existing) throw new Error("Reserva no encontrada.");
    r = existing;
    if (r.version !== t.expectedVersion)
      throw new Error(
        "Otro administrador actualizó esta reserva. Recarga antes de continuar.",
      );
    if (r.status === "released") throw new Error("La reserva ya fue liberada.");
    if (t.action === "release") {
      if (r.status === "sold")
        throw new Error(
          "Una venta cerrada requiere revisión antes de cancelarse.",
        );
      r.status = "released";
    }
    if (t.action === "delivery") {
      if (
        r.status === "sold" &&
        ((t.paymentConfirmed !== undefined && !t.paymentConfirmed) ||
          (t.deliveryStatus && t.deliveryStatus !== "completed"))
      )
        throw new Error(
          "Una venta cerrada no puede perder su verificación de pago o entrega.",
        );
      r.deliveryStatus = t.deliveryStatus ?? r.deliveryStatus;
      r.paymentConfirmed = t.paymentConfirmed ?? r.paymentConfirmed;
    }
    if (t.action === "sell") {
      if (r.status === "sold") throw new Error("Esta venta ya fue confirmada.");
      if (!r.paymentConfirmed || r.deliveryStatus !== "completed")
        throw new Error(
          "Verifica el pago y completa la transferencia antes de cerrar la venta.",
        );
      r.status = "sold";
    }
    if (t.notes !== undefined) r.notes = t.notes;
    r.version++;
    if (t.action !== "delivery")
      for (const seat of state.inventory.filter(
        (i) => i.matchId === match.id && r.seatIds.includes(i.seatId),
      )) {
        seat.status =
          r.status === "released"
            ? "available"
            : r.status === "sold"
              ? "sold"
              : "reserved";
        seat.version++;
      }
  }
  state.audit.unshift({
    id: crypto.randomUUID(),
    actor,
    action: t.action,
    at: now.toISOString(),
    details: `${match.opponent} · ${r.seatIds.join(", ")}`,
  });
  if (r.customerPhone && t.action !== "delivery")
    state.outbox.push({
      id: crypto.randomUUID(),
      eventKey: `${r.id}:${r.version}`,
      phone: r.customerPhone,
      text: `Relampamigos · Guadalajara vs ${match.opponent}. Tu solicitud ${r.id.slice(0, 8)}: ${r.status === "reserved" ? "apartado confirmado; revisaremos el plazo de " + state.settings.holdMinutes + " minutos contigo" : r.status === "sold" ? "venta confirmada y transferencia completada" : "apartado liberado"}. Lugares: ${r.seatIds.map((id) => id.split("-")[1]).join(", ")}. Total ${money(r.total)}, sin cargos adicionales.`,
      status: "pending",
      attempts: 0,
      createdAt: now.toISOString(),
      lastInboundAt: r.lastInboundAt,
    });
  return r;
}
