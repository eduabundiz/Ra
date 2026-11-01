import { createHmac, timingSafeEqual } from "node:crypto";
import { isDemo, hasSupabase } from "./config";
import { mutateDemo } from "./demo";
import { serviceClient } from "./supabase";
import {
  PACKAGES,
  type Match,
  type Inquiry,
  matchDate,
  matchTime,
  money,
} from "./domain";
export function waLink(phone: string, text: string) {
  if (!/^\d{10,15}$/.test(phone))
    throw new Error("Teléfono de contacto inválido.");
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
export function inquiryMessage(m: Match, i: Inquiry) {
  return `${m.demo ? "[DEMOSTRACIÓN · SIN COMPRA REAL]\n" : ""}¡Hola, Relampamigos! Me interesa Guadalajara vs ${m.opponent}.\nFecha: ${matchDate(m.kickoff)}, ${matchTime(m.kickoff)} (Guadalajara).\nModalidad: ${i.packageId ? PACKAGES.find((p) => p.id === i.packageId)?.label : "Selección individual"}.\nLugares: ${i.seatIds.join(", ")}.\nCantidad: ${i.seatIds.length}.\nPrecio total: ${money(i.total)} MXN, sin cargos adicionales.\nReferencia: ${i.code}.\n¿Me confirman disponibilidad? Entiendo que esta consulta todavía no aparta los lugares.`;
}
export function verifyWebhook(
  raw: string,
  signature: string | null,
  secret: string,
) {
  if (!secret || !signature?.startsWith("sha256=")) return false;
  const got = Buffer.from(signature.slice(7), "hex"),
    expected = createHmac("sha256", secret).update(raw).digest();
  return got.length === expected.length && timingSafeEqual(got, expected);
}
type WaMessage = {
  id: string;
  from: string;
  timestamp: string;
  text?: { body: string };
};
type WaStatus = { id: string; status: string; errors?: unknown[] };
type WaPayload = {
  object?: string;
  entry?: {
    changes?: {
      value?: {
        metadata?: { phone_number_id?: string };
        messages?: WaMessage[];
        statuses?: WaStatus[];
      };
    }[];
  }[];
};
export async function processWebhook(payload: WaPayload) {
  if (payload.object !== "whatsapp_business_account") return;
  for (const entry of payload.entry || [])
    for (const change of entry.changes || []) {
      const value = change.value;
      if (
        !value ||
        value.metadata?.phone_number_id !== process.env.WHATSAPP_PHONE_NUMBER_ID
      )
        continue;
      for (const m of value.messages || []) {
        const code = m.text?.body
          .match(/\bRL-[A-F0-9]{12}\b/i)?.[0]
          .toUpperCase();
        if (!code || !m.id || !/^\d{10,15}$/.test(m.from)) continue;
        const stamp = Number(m.timestamp) * 1000;
        if (!Number.isFinite(stamp) || stamp > Date.now() + 60000) continue;
        const at = new Date(stamp).toISOString();
        if (isDemo()) {
          await mutateDemo((s) => {
            if (s.audit.some((a) => a.id === m.id)) return;
            const i = s.inquiries.find((i) => i.code === code);
            if (!i || (i.customerPhone && i.customerPhone !== m.from)) return;
            i.customerPhone = m.from;
            i.contacted = true;
            i.lastInboundAt = at;
            s.audit.unshift({
              id: m.id,
              actor: "whatsapp",
              action: "consulta recibida",
              at,
              details: code,
            });
          });
        } else {
          const r = await serviceClient().rpc("process_whatsapp_message", {
            p_id: m.id,
            p_code: code,
            p_phone: m.from,
            p_timestamp: at,
          });
          if (r.error) throw new Error(r.error.message);
        }
      }
      if (!isDemo())
        for (const status of value.statuses || []) {
          if (status.status === "failed") {
            const r = await serviceClient()
              .from("whatsapp_outbox")
              .update({
                status: "review",
                error:
                  "Meta reportó un fallo de entrega. Revisa WhatsApp Manager.",
              })
              .eq("meta_id", status.id);
            if (r.error) throw new Error(r.error.message);
          }
        }
    }
}
export async function dispatchOutbox() {
  if (isDemo())
    return mutateDemo((s) => {
      let count = 0;
      for (const item of s.outbox.filter((x) => x.status === "pending")) {
        item.status = "simulated";
        count++;
      }
      return { processed: count, mode: "simulated" };
    });
  if (!hasSupabase() || process.env.WHATSAPP_MODE !== "live")
    return { processed: 0, mode: "disabled" };
  const token = process.env.WHATSAPP_ACCESS_TOKEN,
    phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID,
    version = process.env.WHATSAPP_GRAPH_VERSION;
  if (!token || !phoneId || !version || !/^v\d+\.\d+$/.test(version))
    throw new Error("Configuración de Cloud API incompleta.");
  const sb = serviceClient();
  const claim = await sb.rpc("claim_whatsapp_outbox");
  if (claim.error) throw new Error(claim.error.message);
  let count = 0;
  for (const row of claim.data || []) {
    const item = row.data;
    const inWindow =
      item.lastInboundAt &&
      Date.now() - new Date(item.lastInboundAt).getTime() < 24 * 3600000;
    const template = process.env.WHATSAPP_STATUS_TEMPLATE;
    if (!inWindow && !template) {
      await sb
        .from("whatsapp_outbox")
        .update({
          status: "review",
          error:
            "Fuera de la ventana de servicio. Configura una plantilla utility aprobada o continúa manualmente.",
        })
        .eq("id", row.id);
      continue;
    }
    const body = inWindow
      ? {
          messaging_product: "whatsapp",
          to: item.phone,
          type: "text",
          text: { body: item.text },
        }
      : {
          messaging_product: "whatsapp",
          to: item.phone,
          type: "template",
          template: {
            name: template,
            language: { code: "es_MX" },
            components: [
              { type: "body", parameters: [{ type: "text", text: item.text }] },
            ],
          },
        };
    try {
      const res = await fetch(
        `https://graph.facebook.com/${version}/${phoneId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10000),
        },
      );
      const result = await res.json();
      if (!res.ok) {
        const retry = res.status === 429 || res.status >= 500;
        await sb
          .from("whatsapp_outbox")
          .update({
            status: retry && row.attempts < 3 ? "pending" : "review",
            error: `Meta HTTP ${res.status}: ${result.error?.code || "error"}`,
          })
          .eq("id", row.id);
        continue;
      }
      await sb
        .from("whatsapp_outbox")
        .update({
          status: "sent",
          meta_id: result.messages?.[0]?.id,
          error: null,
        })
        .eq("id", row.id);
      count++;
    } catch {
      await sb
        .from("whatsapp_outbox")
        .update({
          status: "review",
          error:
            "Respuesta incierta de Meta. Revisa la entrega antes de reenviar para evitar mensajes duplicados.",
        })
        .eq("id", row.id);
    }
  }
  return { processed: count, mode: "live" };
}
