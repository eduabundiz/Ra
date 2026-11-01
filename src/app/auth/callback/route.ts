import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { userClient } from "@/lib/supabase";
import { siteUrl } from "@/lib/config";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code"),
    token_hash = url.searchParams.get("token_hash");
  const sb = await userClient();
  const result = code
    ? await sb.auth.exchangeCodeForSession(code)
    : token_hash
      ? await sb.auth.verifyOtp({
          token_hash,
          type: (url.searchParams.get("type") || "invite") as EmailOtpType,
        })
      : null;
  const next = url.searchParams.get("next");
  if (result && !result.error)
    return NextResponse.redirect(
      siteUrl() + (next === "/admin/password" ? next : "/admin"),
    );
  return NextResponse.redirect(siteUrl() + "/admin/login?error=enlace");
}
