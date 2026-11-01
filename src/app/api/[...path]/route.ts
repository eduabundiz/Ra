import { NextResponse, after } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  snapshot,
  saveMatch,
  saveSettings,
  transition,
  createInquiry,
  importMatches,
  saveMedia,
  consumeLimit,
} from "@/lib/repository";
import { requireAdmin, checkOrigin, same, signDemo } from "@/lib/auth";
import { isDemo, hasSupabase, siteUrl } from "@/lib/config";
import { serviceClient, userClient } from "@/lib/supabase";
import { matchSchema, settingsSchema, type Media } from "@/lib/domain";
import { demoDirectory, mutateDemo } from "@/lib/demo";
import { excelTemplate, parseExcel } from "@/lib/excel";
import {
  waLink,
  inquiryMessage,
  verifyWebhook,
  processWebhook,
  dispatchOutbox,
} from "@/lib/whatsapp";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
function queueDispatch() {
  after(async () => {
    try {
      await dispatchOutbox();
    } catch {
      console.error("WhatsApp queue pending: inspect the outbox.");
    }
  });
}
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
function apiPath(r: Request) {
  return new URL(r.url).pathname.replace(/^\/api\//, "");
}
function ip(r: Request) {
  return r.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
function error(e: unknown) {
  const message =
    e instanceof z.ZodError
      ? e.issues.map((i) => i.message).join(" · ")
      : e instanceof Error
        ? e.message
        : "Ocurrió un error.";
  if (message === "UNAUTHORIZED")
    return json({ error: "Inicia sesión para continuar." }, 401);
  if (message === "FORBIDDEN")
    return json(
      { error: "Solo el propietario puede realizar esta acción." },
      403,
    );
  return json({ error: message }, 400);
}
export async function GET(r: Request) {
  try {
    const p = apiPath(r);
    if (p === "catalog") return json(await snapshot());
    if (p === "health")
      return json({
        ok: true,
        demo: isDemo(),
        database: hasSupabase(),
        whatsapp: process.env.WHATSAPP_MODE === "live",
      });
    if (p === "whatsapp/webhook") {
      const u = new URL(r.url);
      if (
        u.searchParams.get("hub.mode") === "subscribe" &&
        process.env.WHATSAPP_VERIFY_TOKEN &&
        same(
          u.searchParams.get("hub.verify_token") || "",
          process.env.WHATSAPP_VERIFY_TOKEN,
        )
      )
        return new Response(u.searchParams.get("hub.challenge"));
      return new Response("Forbidden", { status: 403 });
    }
    if (p === "cron/whatsapp") {
      if (
        !process.env.CRON_SECRET ||
        !same(
          r.headers.get("authorization") || "",
          `Bearer ${process.env.CRON_SECRET}`,
        )
      )
        return json({ error: "Forbidden" }, 403);
      return json(await dispatchOutbox());
    }
    if (p.startsWith("admin/")) {
      const a = await requireAdmin();
      if (p === "admin/state") {
        const s = await snapshot(true);
        const admins = isDemo()
          ? [{ user_id: a.id, email: a.email, role: a.role, active: true }]
          : (
              await serviceClient()
                .from("admin_accounts")
                .select("user_id,email,role,active")
                .order("email")
            ).data;
        return json({
          ...s,
          admin: a,
          admins,
          demo: isDemo(),
          integration: {
            configured: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
            mode: process.env.WHATSAPP_MODE || "disabled",
          },
        });
      }
      if (p === "admin/template")
        return new Response(new Uint8Array(await excelTemplate()), {
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition":
              'attachment; filename="partidos-relampamigos.xlsx"',
          },
        });
    }
    return json({ error: "Ruta no encontrada." }, 404);
  } catch (e) {
    return error(e);
  }
}
const transitionSchema = z.object({
  action: z.enum(["reserve", "release", "sell", "delivery"]),
  matchId: z.uuid(),
  seatIds: z.array(z.string()).max(10).optional(),
  packageId: z.enum(["A5", "B5", "B3", "B2"]).optional(),
  reservationId: z.uuid().optional(),
  expectedVersion: z.number().int().optional(),
  customerName: z.string().max(100).optional(),
  customerPhone: z.string().max(15).optional(),
  notes: z.string().max(1000).optional(),
  deliveryStatus: z.enum(["pending", "sent", "completed"]).optional(),
  paymentConfirmed: z.boolean().optional(),
  lastInboundAt: z.iso.datetime({ offset: true }).optional(),
});
export async function POST(r: Request) {
  try {
    const p = apiPath(r);
    if (p === "whatsapp/webhook") {
      const raw = await r.text();
      if (raw.length > 1000000)
        return json({ error: "Payload too large" }, 413);
      if (
        !verifyWebhook(
          raw,
          r.headers.get("x-hub-signature-256"),
          process.env.WHATSAPP_APP_SECRET || "",
        )
      )
        return json({ error: "Invalid signature" }, 403);
      try {
        await processWebhook(JSON.parse(raw));
        queueDispatch();
        return json({ received: true });
      } catch {
        return json({ error: "Retry later" }, 503);
      }
    }
    checkOrigin(r);
    if (p === "login") {
      await consumeLimit("login:" + ip(r), 10);
      const v = z
        .object({ email: z.email(), password: z.string().min(1).max(200) })
        .parse(await r.json());
      if (isDemo()) {
        if (
          !process.env.DEMO_ADMIN_PASSWORD ||
          !process.env.DEMO_SESSION_SECRET ||
          !same(v.email, "demo@relampamigos.local") ||
          !same(v.password, process.env.DEMO_ADMIN_PASSWORD)
        )
          throw new Error("Correo o contraseña incorrectos.");
        const until = String(Date.now() + 8 * 3600000);
        (await cookies()).set(
          "relampamigos_demo",
          `${until}.${signDemo(until)}`,
          {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 8 * 3600,
          },
        );
      } else {
        if (!hasSupabase())
          throw new Error(
            "Configura Supabase para habilitar el acceso administrativo.",
          );
        const sb = await userClient();
        const result = await sb.auth.signInWithPassword(v);
        if (result.error) throw new Error("Correo o contraseña incorrectos.");
        try {
          await requireAdmin();
        } catch {
          await sb.auth.signOut();
          throw new Error("Esta cuenta no tiene acceso administrativo.");
        }
      }
      return json({ ok: true });
    }
    if (p === "logout") {
      if (isDemo()) (await cookies()).delete("relampamigos_demo");
      else if (hasSupabase()) await (await userClient()).auth.signOut();
      return json({ ok: true });
    }
    if (p === "inquiries") {
      await consumeLimit("inquiry:" + ip(r), 30);
      const v = z
        .object({
          matchId: z.uuid(),
          seatIds: z.array(z.string()).min(1).max(10),
          packageId: z.string().optional(),
          requestId: z.uuid(),
        })
        .parse(await r.json());
      const inquiry = await createInquiry(
        v.matchId,
        v.seatIds,
        v.packageId,
        v.requestId,
        ip(r),
      );
      const s = await snapshot();
      const m = s.matches.find((m) => m.id === v.matchId);
      if (!m) throw new Error("El partido dejó de estar disponible.");
      return json({
        code: inquiry.code,
        text: inquiryMessage(m, inquiry),
        url: waLink(s.settings.phone, inquiryMessage(m, inquiry)),
        total: inquiry.total,
        demo: isDemo(),
      });
    }
    const a = await requireAdmin();
    if (p === "admin/demo-contact") {
      if (!isDemo()) return json({ error: "Not found" }, 404);
      const v = z.object({ id: z.uuid() }).parse(await r.json());
      await mutateDemo((s) => {
        const i = s.inquiries.find((i) => i.id === v.id);
        if (!i) throw new Error("Consulta no encontrada.");
        i.contacted = true;
        i.customerPhone = "520000000000";
        i.lastInboundAt = new Date().toISOString();
      });
      return json({ ok: true });
    }
    if (p === "admin/save-match") return json(await saveMatch(await r.json()));
    if (p === "admin/transition") {
      const result = await transition(
        transitionSchema.parse(await r.json()),
        a.email,
      );
      queueDispatch();
      return json({ reservation: result });
    }
    if (p === "admin/settings") {
      await saveSettings(settingsSchema.parse(await r.json()));
      return json({ ok: true });
    }
    if (p === "admin/import-preview") {
      const f = (await r.formData()).get("file");
      if (
        !(f instanceof File) ||
        !f.name.toLowerCase().endsWith(".xlsx") ||
        f.size > 2 * 1024 * 1024
      )
        throw new Error("Selecciona un Excel .xlsx de hasta 2 MB.");
      return json(await parseExcel(Buffer.from(await f.arrayBuffer())));
    }
    if (p === "admin/import") {
      const v = z
        .array(matchSchema)
        .min(1)
        .max(100)
        .parse(await r.json())
        .map((m) => ({ ...m, published: false, version: 0 }));
      if (new Set(v.map((m) => m.slug)).size !== v.length)
        throw new Error("Hay claves duplicadas.");
      return json({ imported: await importMatches(v) });
    }
    if (p === "admin/upload") {
      const form = await r.formData();
      const file = form.get("file");
      if (
        !(file instanceof File) ||
        file.size > 8 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "image/webp"].includes(file.type)
      )
        throw new Error("Usa JPG, PNG o WebP de hasta 8 MB.");
      const title = z.string().min(3).max(150).parse(form.get("title"));
      const group = z.enum(["A", "B", "all"]).parse(form.get("group"));
      const kind = z
        .enum(["photo", "evidence", "logo"])
        .parse(form.get("kind") || "photo");
      const image = sharp(Buffer.from(await file.arrayBuffer()), {
        limitInputPixels: 30000000,
      });
      const metadata = await image.metadata();
      if (
        !metadata.format ||
        !["jpeg", "png", "webp"].includes(metadata.format)
      )
        throw new Error(
          "El contenido debe ser una imagen JPG, PNG o WebP válida.",
        );
      const normalized = await image
        .rotate()
        .resize({ width: 2000, withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      const id = crypto.randomUUID();
      const filename = `${id}.jpg`;
      if (isDemo()) {
        await mkdir(path.join(demoDirectory, "uploads"), { recursive: true });
        await writeFile(
          path.join(demoDirectory, "uploads", filename),
          normalized,
        );
      } else {
        const upload = await serviceClient()
          .storage.from("site-media")
          .upload(filename, normalized, {
            contentType: "image/jpeg",
            upsert: false,
          });
        if (upload.error) throw new Error(upload.error.message);
      }
      const media: Media = {
        id,
        title,
        group,
        kind,
        position: Date.now(),
        published: false,
        file: filename,
        createdAt: new Date().toISOString(),
      };
      await saveMedia(media);
      return json(media);
    }
    if (p === "admin/media") {
      const v = z
        .object({ id: z.uuid(), published: z.boolean(), reviewed: z.boolean() })
        .parse(await r.json());
      if (v.published && !v.reviewed)
        throw new Error(
          "Revisa que no haya QR, códigos de boleto ni información privada.",
        );
      const s = await snapshot(true);
      const m = s.media.find((m) => m.id === v.id);
      if (!m) throw new Error("Fotografía no encontrada.");
      m.published = v.published;
      await saveMedia(m);
      return json({ ok: true });
    }
    if (p === "admin/reorder-media") {
      const v = z
        .object({ id: z.uuid(), direction: z.enum(["up", "down"]) })
        .parse(await r.json());
      const s = await snapshot(true);
      const index = s.media.findIndex((m) => m.id === v.id),
        other = index + (v.direction === "up" ? -1 : 1);
      if (index < 0 || other < 0 || other >= s.media.length)
        return json({ ok: true });
      s.media.forEach((m, i) => (m.position = i));
      const one = s.media[index],
        two = s.media[other];
      [one.position, two.position] = [two.position, one.position];
      if (isDemo())
        await mutateDemo((state) => {
          for (const m of state.media) {
            m.position = s.media.find((x) => x.id === m.id)?.position ?? 0;
          }
        });
      else {
        const result = await serviceClient()
          .from("media")
          .upsert(
            s.media.map((m) => ({ id: m.id, published: m.published, data: m })),
          );
        if (result.error) throw new Error(result.error.message);
      }
      return json({ ok: true });
    }
    if (p === "admin/dispatch") return json(await dispatchOutbox());
    if (p === "admin/invite") {
      await requireAdmin(true);
      if (isDemo())
        throw new Error(
          "Las invitaciones se habilitan al conectar Supabase Auth.",
        );
      const v = z
        .object({ email: z.email(), role: z.enum(["editor", "owner"]) })
        .parse(await r.json());
      const sb = serviceClient();
      const invited = await sb.auth.admin.inviteUserByEmail(v.email, {
        redirectTo: siteUrl() + "/auth/callback?next=/admin/password",
      });
      if (invited.error || !invited.data.user)
        throw new Error(invited.error?.message || "No se pudo invitar.");
      const inserted = await sb.from("admin_accounts").upsert({
        user_id: invited.data.user.id,
        email: v.email,
        role: v.role,
        active: true,
      });
      if (inserted.error) throw new Error(inserted.error.message);
      return json({ ok: true });
    }
    if (p === "admin/deactivate") {
      await requireAdmin(true);
      if (isDemo()) throw new Error("Acción disponible con Supabase.");
      const v = z.object({ id: z.uuid() }).parse(await r.json());
      if (v.id === a.id)
        throw new Error("No puedes desactivar tu propia cuenta.");
      const result = await serviceClient()
        .from("admin_accounts")
        .update({ active: false })
        .eq("user_id", v.id);
      if (result.error) throw new Error(result.error.message);
      return json({ ok: true });
    }
    if (p === "admin/password") {
      if (isDemo())
        throw new Error("Configura la contraseña demo en .env.local.");
      const v = z
        .object({ password: z.string().min(12).max(200) })
        .parse(await r.json());
      const result = await (
        await userClient()
      ).auth.updateUser({ password: v.password });
      if (result.error) throw new Error(result.error.message);
      return json({ ok: true });
    }
    return json({ error: "Ruta no encontrada." }, 404);
  } catch (e) {
    return error(e);
  }
}
