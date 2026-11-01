import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { snapshot } from "@/lib/repository";
import { isDemo } from "@/lib/config";
import { Header, Footer, MatchExperience } from "@/components/public";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const s = await snapshot();
  const m = s.matches.find((m) => m.slug === slug);
  return {
    title: m ? `Guadalajara vs ${m.opponent}` : "Partido no encontrado",
  };
}
export default async function MatchPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const s = await snapshot();
  if (!s.matches.some((m) => m.slug === slug)) notFound();
  return (
    <>
      <Header settings={s.settings} demo={isDemo()} />
      <main id="main">
        <MatchExperience initial={s} slug={slug} />
      </main>
      <Footer settings={s.settings} />
    </>
  );
}
