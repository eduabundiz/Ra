import type { MetadataRoute } from "next";
import { siteUrl, isDemo } from "@/lib/config";
import { snapshot } from "@/lib/repository";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (isDemo()) return [];
  const s = await snapshot();
  return [
    "",
    "/partidos",
    "/privacidad",
    "/terminos",
    ...s.matches.map((m) => "/partidos/" + m.slug),
  ].map((p) => ({
    url: siteUrl() + p,
    changeFrequency: "weekly",
    priority: p === "" ? 1 : 0.7,
  }));
}
