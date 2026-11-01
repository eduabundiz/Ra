import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import {
  SEATS,
  PACKAGES,
  emptyState,
  quote,
  applyTransition,
  availability,
  matchSchema,
  type Match,
} from "../src/lib/domain";
import { verifyWebhook, waLink, inquiryMessage } from "../src/lib/whatsapp";
import { publicState } from "../src/lib/repository";
const match: Match = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "ejemplo-solo-prueba",
  opponent: "Rival de prueba",
  competition: "Prueba",
  kickoff: "2099-01-08T02:00:00Z",
  stadium: "Estadio Akron",
  published: true,
  allowIndividual: true,
  prices: {
    A5: 500000,
    B5: 400000,
    B3: 250000,
    B2: 180000,
    individualA: 110000,
    individualB: 90000,
  },
  version: 1,
};
function fixture() {
  const s = emptyState();
  s.matches = [{ ...match }];
  s.inventory = SEATS.map((seat) => ({
    matchId: match.id,
    seatId: seat.id,
    status: "available",
    version: 1,
  }));
  return s;
}
describe("Inventario y reglas comerciales", () => {
  it("conserva exactamente los diez asientos proporcionados", () => {
    expect(SEATS.map((s) => `${s.section}:${s.row}-${s.number}`)).toEqual([
      "T1-04:S-15",
      "T1-04:S-16",
      "T1-04:S-17",
      "T1-04:S-18",
      "T1-04:S-19",
      "T1-24:R-10",
      "T1-24:R-11",
      "T1-24:R-12",
      "T1-24:Q-13",
      "T1-24:Q-14",
    ]);
  });
  it("cotiza un paquete y asientos individuales desde precios del servidor", () => {
    expect(quote(match, [...PACKAGES[0].seatIds], "A5")).toBe(500000);
    expect(quote(match, ["A-S15", "B-R10"])).toBe(200000);
  });
  it("rechaza duplicados, asientos inventados y paquetes adulterados", () => {
    expect(() => quote(match, ["A-S15", "A-S15"])).toThrow();
    expect(() => quote(match, ["A-S999"])).toThrow();
    expect(() => quote(match, ["A-S15"], "A5")).toThrow();
  });
  it("respeta el interruptor de individuales", () =>
    expect(() =>
      quote({ ...match, allowIndividual: false }, ["A-S15"]),
    ).toThrow(/individual/));
  it("apartar B3 bloquea ese mismo inventario dentro del paquete B5", () => {
    const s = fixture();
    applyTransition(
      s,
      {
        action: "reserve",
        matchId: match.id,
        seatIds: [...PACKAGES[2].seatIds],
        packageId: "B3",
      },
      "uno",
    );
    expect(() =>
      applyTransition(
        s,
        {
          action: "reserve",
          matchId: match.id,
          seatIds: [...PACKAGES[1].seatIds],
          packageId: "B5",
        },
        "dos",
      ),
    ).toThrow(/disponibles/);
    expect(availability(s.inventory).available).toBe(7);
  });
  it("mantiene cada partido independiente", () => {
    const s = fixture();
    const m = { ...match, id: "22222222-2222-4222-8222-222222222222" };
    s.matches.push(m);
    s.inventory.push(
      ...SEATS.map((seat) => ({
        matchId: m.id,
        seatId: seat.id,
        status: "available" as const,
        version: 1,
      })),
    );
    applyTransition(
      s,
      {
        action: "reserve",
        matchId: match.id,
        seatIds: [...PACKAGES[0].seatIds],
        packageId: "A5",
      },
      "uno",
    );
    expect(
      availability(s.inventory.filter((i) => i.matchId === m.id)).available,
    ).toBe(10);
  });
  it("requiere verificar pago y entrega antes de cerrar una venta y controla versiones", () => {
    const s = fixture();
    const r = applyTransition(
      s,
      { action: "reserve", matchId: match.id, seatIds: ["A-S15"] },
      "uno",
    );
    expect(() =>
      applyTransition(
        s,
        {
          action: "sell",
          matchId: match.id,
          reservationId: r.id,
          expectedVersion: r.version,
        },
        "uno",
      ),
    ).toThrow(/pago/);
    applyTransition(
      s,
      {
        action: "delivery",
        matchId: match.id,
        reservationId: r.id,
        expectedVersion: 1,
        paymentConfirmed: true,
        deliveryStatus: "completed",
      },
      "uno",
    );
    expect(() =>
      applyTransition(
        s,
        {
          action: "release",
          matchId: match.id,
          reservationId: r.id,
          expectedVersion: 1,
        },
        "dos",
      ),
    ).toThrow(/administrador/);
    applyTransition(
      s,
      {
        action: "sell",
        matchId: match.id,
        reservationId: r.id,
        expectedVersion: 2,
      },
      "uno",
    );
    expect(s.inventory[0].status).toBe("sold");
    expect(() =>
      applyTransition(
        s,
        {
          action: "delivery",
          matchId: match.id,
          reservationId: r.id,
          expectedVersion: 3,
          paymentConfirmed: false,
        },
        "uno",
      ),
    ).toThrow(/cerrada/);
  });
  it("el plazo vencido no libera automáticamente y la liberación sí devuelve inventario", () => {
    const s = fixture();
    const r = applyTransition(
      s,
      { action: "reserve", matchId: match.id, seatIds: ["A-S15"] },
      "uno",
      new Date("2026-01-01T00:00:00Z"),
    );
    expect(r.reviewAt).toBe("2026-01-01T00:30:00.000Z");
    expect(s.inventory[0].status).toBe("reserved");
    applyTransition(
      s,
      {
        action: "release",
        matchId: match.id,
        reservationId: r.id,
        expectedVersion: 1,
      },
      "uno",
    );
    expect(s.inventory[0].status).toBe("available");
  });
  it("no permite publicar partidos sin precio de grupo", () =>
    expect(
      matchSchema.safeParse({
        ...match,
        prices: {
          A5: null,
          B5: null,
          B3: null,
          B2: null,
          individualA: 100,
          individualB: 100,
        },
      }).success,
    ).toBe(false));
  it("la proyección pública elimina reservas, consultas, avisos y borradores", () => {
    const s = fixture();
    s.matches.push({ ...match, id: crypto.randomUUID(), published: false });
    applyTransition(
      s,
      {
        action: "reserve",
        matchId: match.id,
        seatIds: ["A-S15"],
        customerName: "Privado",
        customerPhone: "523300000000",
      },
      "uno",
    );
    const p = publicState(s);
    expect(p.matches).toHaveLength(1);
    expect(p.reservations).toEqual([]);
    expect(p.outbox).toEqual([]);
    expect(p.audit).toEqual([]);
    expect(JSON.stringify(p)).not.toContain("Privado");
  });
});
describe("Integración WhatsApp", () => {
  it("verifica HMAC sobre los bytes originales y rechaza firmas manipuladas", () => {
    const raw = '{"ok":true}',
      secret = "solo-prueba";
    const sig =
      "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
    expect(verifyWebhook(raw, sig, secret)).toBe(true);
    expect(verifyWebhook(raw + " ", sig, secret)).toBe(false);
    expect(verifyWebhook(raw, "sha256=abc", secret)).toBe(false);
  });
  it("incluye grupo, fecha local, cantidad, total y referencia con URL segura", () => {
    const i = {
      id: crypto.randomUUID(),
      code: "RL-123456ABCDEF",
      matchId: match.id,
      seatIds: [...PACKAGES[0].seatIds],
      packageId: "A5",
      total: 500000,
      createdAt: new Date().toISOString(),
      contacted: false,
    };
    const message = inquiryMessage(match, i);
    const url = new URL(waLink("523314581203", message));
    expect(url.origin).toBe("https://wa.me");
    expect(url.searchParams.get("text")).toBe(message);
    expect(message).toContain("Poniente");
    expect(message).toContain("Cantidad: 5");
    expect(message).toContain("7 de enero de 2099");
    expect(message).toContain(i.code);
  });
});
