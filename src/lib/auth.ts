import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { isDemo, hasSupabase } from "./config";
import { userClient } from "./supabase";
export type Admin = { id: string; email: string; role: "owner" | "editor" };
export function same(a: string, b: string) {
  const aa = Buffer.from(a),
    bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
export function signDemo(payload: string) {
  return createHmac("sha256", process.env.DEMO_SESSION_SECRET || "")
    .update(payload)
    .digest("hex");
}
export async function getAdmin(): Promise<Admin | null> {
  if (isDemo()) {
    if (!process.env.DEMO_SESSION_SECRET) return null;
    const token = (await cookies()).get("relampamigos_demo")?.value || "";
    const [expires, sig] = token.split(".");
    if (
      !expires ||
      !sig ||
      Number(expires) < Date.now() ||
      !same(signDemo(expires), sig)
    )
      return null;
    return {
      id: "demo-owner",
      email: "demo@relampamigos.local",
      role: "owner",
    };
  }
  if (!hasSupabase()) return null;
  const sb = await userClient();
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) return null;
  const { data } = await sb
    .from("admin_accounts")
    .select("user_id,email,role")
    .eq("user_id", user.id)
    .eq("active", true)
    .single();
  return data ? { id: user.id, email: data.email, role: data.role } : null;
}
export async function requireAdmin(owner = false) {
  const a = await getAdmin();
  if (!a) throw new Error("UNAUTHORIZED");
  if (owner && a.role !== "owner") throw new Error("FORBIDDEN");
  return a;
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = process.env.SITE_URL;
  if (
    !origin ||
    origin !==
      (expected ? new URL(expected).origin : new URL(request.url).origin)
  )
    throw new Error("Origen de solicitud no permitido.");
}
