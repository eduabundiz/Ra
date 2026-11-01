import { createHash } from "node:crypto";
import { isDemo, hasSupabase } from "./config";
import { readDemo, mutateDemo } from "./demo";
import { serviceClient, userClient } from "./supabase";
import {
  applyTransition,
  emptyState,
  SEATS,
  quote,
  matchSchema,
  type Match,
  type State,
  type Transition,
  type Inquiry,
  type Settings,
  type Media,
} from "./domain";
function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}
export async function snapshot(admin = false): Promise<State> {
  if (isDemo()) {
    const s = await readDemo();
    s.media.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    return admin ? s : publicState(s);
  }
  if (!hasSupabase()) return emptyState();
  const sb = serviceClient();
  let q = sb.from("matches").select("data");
  if (!admin) q = q.eq("published", true);
  const matches = await q;
  fail(matches.error);
  const data = emptyState();
  data.matches = (matches.data || []).map((r) => r.data as Match);
  const inv = data.matches.length
    ? await sb
        .from("seat_inventory")
        .select("match_id,seat_id,status,version")
        .in(
          "match_id",
          data.matches.map((m) => m.id),
        )
    : { data: [], error: null };
  fail(inv.error);
  data.inventory = (inv.data || []).map((r) => ({
    matchId: r.match_id,
    seatId: r.seat_id,
    status: r.status,
    version: r.version,
  }));
  const [settings, media] = await Promise.all([
    sb.from("site_settings").select("data").eq("id", 1).single(),
    sb.from("media").select("data,published").eq("published", true),
  ]);
  // Admin media must include drafts too.
  if (admin) {
    const all = await sb.from("media").select("data");
    fail(all.error);
    data.media = (all.data || []).map((r) => r.data);
  } else {
    fail(media.error);
    data.media = (media.data || []).map((r) => r.data);
  }
  if (settings.error && settings.error.code !== "PGRST116")
    fail(settings.error);
  if (settings.data)
    data.settings = { ...data.settings, ...settings.data.data };
  if (admin) {
    const [r, i, o, a] = await Promise.all([
      sb
        .from("reservations")
        .select("data")
        .order("created_at", { ascending: false }),
      sb
        .from("inquiries")
        .select("data")
        .order("created_at", { ascending: false })
        .limit(200),
      sb
        .from("whatsapp_outbox")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      sb
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    [r, i, o, a].forEach((v) => fail(v.error));
    data.reservations = (r.data || []).map((v) => v.data);
    data.inquiries = (i.data || []).map((v) => v.data);
    data.outbox = (o.data || []).map((v) => ({
      ...v.data,
      id: v.id,
      status: v.status,
      attempts: v.attempts,
      error: v.error,
      metaId: v.meta_id,
    }));
    data.audit = (a.data || []).map((v) => ({
      id: v.id,
      actor: v.actor,
      action: v.action,
      at: v.created_at,
      details: v.details,
    }));
  }
  data.media.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  return admin ? data : publicState(data);
}
export function publicState(state: State): State {
  const s = emptyState();
  s.matches = state.matches.filter((m) => m.published);
  s.inventory = state.inventory.filter((i) =>
    s.matches.some((m) => m.id === i.matchId),
  );
  s.settings = state.settings;
  s.media = state.media
    .filter((m) => m.published)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  return s;
}
export async function saveMatch(input: unknown) {
  const m = matchSchema.parse(input);
  if (!isDemo()) delete m.demo;
  if (isDemo())
    return mutateDemo((s) => {
      const old = s.matches.find((x) => x.id === m.id);
      if (s.matches.some((x) => x.slug === m.slug && x.id !== m.id))
        throw new Error("La dirección del partido ya existe.");
      if (old && old.version !== m.version)
        throw new Error(
          "Otro administrador editó el partido. Recarga antes de guardar.",
        );
      m.version++;
      if (old) Object.assign(old, m);
      else {
        s.matches.push(m);
        s.inventory.push(
          ...SEATS.map((seat) => ({
            matchId: m.id,
            seatId: seat.id,
            status: "available" as const,
            version: 1,
          })),
        );
      }
      return m;
    });
  const sb = serviceClient();
  const data = { ...m, version: m.version + 1 };
  if (m.version === 0) {
    const r = await sb.from("matches").insert({
      id: m.id,
      slug: m.slug,
      published: m.published,
      data,
      version: 1,
    });
    fail(r.error);
  } else {
    const r = await sb
      .from("matches")
      .update({
        slug: m.slug,
        published: m.published,
        data,
        version: data.version,
      })
      .eq("id", m.id)
      .eq("version", m.version)
      .select("id");
    fail(r.error);
    if (!r.data?.length)
      throw new Error("El partido cambió. Recarga antes de guardar.");
  }
  return data;
}
export async function importMatches(matches: Match[]) {
  if (isDemo())
    return mutateDemo((s) => {
      for (const m of matches) {
        matchSchema.parse(m);
        if (s.matches.some((x) => x.slug === m.slug))
          throw new Error(`El partido ${m.slug} ya existe.`);
      }
      s.matches.push(...matches.map((m) => ({ ...m, demo: true, version: 1 })));
      s.inventory.push(
        ...matches.flatMap((m) =>
          SEATS.map((seat) => ({
            matchId: m.id,
            seatId: seat.id,
            status: "available" as const,
            version: 1,
          })),
        ),
      );
      return matches.length;
    });
  const sb = serviceClient();
  const r = await sb.from("matches").insert(
    matches.map((m) => ({
      id: m.id,
      slug: m.slug,
      published: false,
      data: { ...m, published: false, version: 1 },
      version: 1,
    })),
  );
  fail(r.error);
  return matches.length;
}
export async function transition(t: Transition, actor: string) {
  if (isDemo()) return mutateDemo((s) => applyTransition(s, t, actor));
  const sb = await userClient();
  const r = await sb.rpc("inventory_transition", {
    p_action: t.action,
    p_match_id: t.matchId,
    p_seat_ids: t.seatIds || [],
    p_package: t.packageId || null,
    p_reservation_id: t.reservationId || null,
    p_expected_version: t.expectedVersion ?? 0,
    p_data: {
      customerName: t.customerName || "",
      customerPhone: t.customerPhone || "",
      notes: t.notes,
      deliveryStatus: t.deliveryStatus,
      paymentConfirmed: t.paymentConfirmed,
      lastInboundAt: t.lastInboundAt,
    },
  });
  fail(r.error);
  return r.data;
}
export async function saveSettings(settings: Settings) {
  if (isDemo())
    return mutateDemo((s) => {
      s.settings = settings;
    });
  const r = await serviceClient()
    .from("site_settings")
    .update({ data: settings })
    .eq("id", 1);
  fail(r.error);
}
export async function saveMedia(media: Media) {
  if (isDemo())
    return mutateDemo((s) => {
      const old = s.media.find((m) => m.id === media.id);
      if (old) Object.assign(old, media);
      else s.media.push(media);
    });
  const r = await serviceClient()
    .from("media")
    .upsert({ id: media.id, published: media.published, data: media });
  fail(r.error);
}
export async function createInquiry(
  matchId: string,
  seatIds: string[],
  packageId: string | undefined,
  id: string,
  ip: string,
): Promise<Inquiry> {
  if (isDemo())
    return mutateDemo((s) => {
      const old = s.inquiries.find((i) => i.id === id);
      if (old) {
        if (
          old.matchId !== matchId ||
          JSON.stringify(old.seatIds) !== JSON.stringify(seatIds)
        )
          throw new Error("La referencia ya se utilizó con otra selección.");
        return old;
      }
      const m = s.matches.find((m) => m.id === matchId && m.published);
      if (!m || new Date(m.kickoff) <= new Date())
        throw new Error("Partido no disponible.");
      const total = quote(m, seatIds, packageId);
      if (
        seatIds.some(
          (id) =>
            !s.inventory.some(
              (i) =>
                i.matchId === matchId &&
                i.seatId === id &&
                i.status === "available",
            ),
        )
      )
        throw new Error("La disponibilidad cambió. Elige de nuevo.");
      const item: Inquiry = {
        id,
        code: "RL-" + id.replaceAll("-", "").slice(0, 12).toUpperCase(),
        matchId,
        seatIds,
        packageId,
        total,
        createdAt: new Date().toISOString(),
        contacted: false,
      };
      s.inquiries.unshift(item);
      return item;
    });
  const r = await serviceClient().rpc("create_inquiry", {
    p_id: id,
    p_match_id: matchId,
    p_seats: seatIds,
    p_package: packageId || null,
    p_rate_key: createHash("sha256").update(ip).digest("hex"),
  });
  fail(r.error);
  return r.data;
}
export async function consumeLimit(key: string, max: number) {
  if (isDemo()) {
    const now = Date.now();
    const current = limits.get(key);
    if (!current || now > current.until) {
      limits.set(key, { count: 1, until: now + 900000 });
      return;
    }
    if (current.count >= max)
      throw new Error("Demasiados intentos. Espera unos minutos.");
    current.count++;
    return;
  }
  if (!hasSupabase()) return;
  const r = await serviceClient().rpc("consume_rate_limit", {
    p_key: createHash("sha256").update(key).digest("hex"),
    p_max: max,
  });
  fail(r.error);
}
const limits = new Map<string, { count: number; until: number }>();
