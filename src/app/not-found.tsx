import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="container error-page">
      <span className="eyebrow">FUERA DE JUEGO · 404</span>
      <h1>
        Este lugar
        <br />
        no existe.
      </h1>
      <p>El partido pudo cambiar de dirección o todavía no está publicado.</p>
      <Link className="button button-red" href="/partidos">
        Ver partidos
      </Link>
    </main>
  );
}
