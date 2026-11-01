"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="container error-page">
      <span className="eyebrow">PAUSA EN EL PARTIDO</span>
      <h1>
        No pudimos
        <br />
        cargar esta página.
      </h1>
      <p>
        Intenta de nuevo. Si estabas confirmando una reserva, revisa su estado
        antes de repetir la operación.
      </p>
      <button className="button button-red" onClick={reset}>
        Intentar de nuevo
      </button>
    </main>
  );
}
