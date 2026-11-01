import { readFile } from "node:fs/promises";
import path from "node:path";
import { isDemo } from "@/lib/config";
import { demoDirectory, readDemo } from "@/lib/demo";
import { serviceClient } from "@/lib/supabase";
import { getAdmin } from "@/lib/auth";
import type { Media } from "@/lib/domain";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id))
    return new Response("Not found", { status: 404 });
  try {
    let media: Media | undefined;
    if (isDemo()) media = (await readDemo()).media.find((m) => m.id === id);
    else {
      const r = await serviceClient()
        .from("media")
        .select("data")
        .eq("id", id)
        .single();
      media = r.data?.data;
    }
    if (!media || (!media.published && !(await getAdmin())))
      return new Response("Not found", { status: 404 });
    let bytes: Uint8Array;
    if (isDemo())
      bytes = new Uint8Array(
        await readFile(
          path.join(demoDirectory, "uploads", path.basename(media.file)),
        ),
      );
    else {
      const r = await serviceClient()
        .storage.from("site-media")
        .download(media.file);
      if (r.error || !r.data) throw new Error("Not found");
      bytes = new Uint8Array(await r.data.arrayBuffer());
    }
    return new Response(bytes as BodyInit, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": media.published
          ? "public, max-age=60"
          : "private, no-store",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
