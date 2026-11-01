import { snapshot } from "@/lib/repository";
import { isDemo } from "@/lib/config";
import { Header, Footer } from "@/components/public";
export const dynamic = "force-dynamic";
export const metadata = { title: "Condiciones de compra" };
export default async function Terms() {
  const { settings: s } = await snapshot();
  return (
    <>
      <Header settings={s} demo={isDemo()} />
      <main id="main" className="container legal-page">
        <span className="eyebrow">ANTES DE HACER EL PLAN</span>
        <h1>Condiciones de compra.</h1>
        <h2>Vendedor independiente</h2>
        <p>
          Chivabonos Relampamigos es una identidad de vendedor independiente. No
          representa ni tiene afiliación oficial con Club Deportivo Guadalajara
          o Boletomóvil. El acceso y las reglas de ingreso dependen del
          organizador y de los términos del abono y del evento correspondiente.
        </p>
        <h2>Consulta, apartado y venta</h2>
        <p>
          La selección en la web y el envío de un mensaje son una consulta. El
          apartado existe únicamente cuando el equipo confirma contigo su
          alcance y lo registra. El plazo orientativo es de {s.holdMinutes}{" "}
          minutos, revisable de forma manual; transcurrir ese plazo no significa
          una liberación automática. La venta se confirma manualmente cuando se
          ha verificado el pago y completado la transferencia acordada.
        </p>
        <h2>Precio y pago</h2>
        <p>
          Los precios se expresan en pesos mexicanos. El total confirmado
          corresponde a los lugares seleccionados y no tiene cargos adicionales
          del vendedor. El pago se coordina directamente por WhatsApp; esta web
          no procesa pagos ni solicita datos bancarios completos. Verifica el
          partido, fecha, sección, fila, cantidad, total y condiciones por
          escrito antes de pagar.
        </p>
        <h2>Entrega</h2>
        <p>
          La entrega se coordina mediante el mecanismo de transferencia de
          Boletomóvil para el partido correspondiente. Necesitas tener una
          cuenta registrada en su app. Verifica que el acceso recibido
          corresponde a lo acordado. Una captura de un código no sustituye la
          transferencia. Usar Boletomóvil no implica que la plataforma avale o
          garantice la operación entre particulares.
        </p>
        <h2>Cancelaciones, reprogramaciones y aclaraciones</h2>
        <p>
          Antes de recibir el pago, el vendedor debe informar por escrito las
          condiciones concretas de cancelación, reprogramación y reembolso que
          apliquen a la operación. Si ocurre un cambio, contacta al vendedor con
          la referencia para revisar la solución y los derechos que
          correspondan. Estas condiciones no limitan derechos irrenunciables
          previstos por la normativa aplicable.
        </p>
        <h2>Requisitos de ingreso</h2>
        <p>
          Revisa las instrucciones vigentes del organizador, los requisitos de
          identificación y las condiciones del evento. La fecha y la hora pueden
          cambiar por decisión del organizador. El vendedor debe comunicar los
          cambios de los que tenga conocimiento.
        </p>
        <h2>Contacto</h2>
        <p>
          {s.privacyName || "Chivabonos Relampamigos"}.{" "}
          <a
            href={`https://wa.me/${s.phone}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp +{s.phone}
          </a>
          . {s.privacyEmail && `Correo: ${s.privacyEmail}.`}
        </p>
      </main>
      <Footer settings={s} />
    </>
  );
}
