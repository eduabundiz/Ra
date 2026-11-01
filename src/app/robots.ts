import type { MetadataRoute } from "next";
import { isDemo, siteUrl } from "@/lib/config";
export const dynamic = "force-dynamic";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: isDemo()
      ? { userAgent: "*", disallow: "/" }
      : { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/auth"] },
    sitemap: siteUrl() + "/sitemap.xml",
  };
}
