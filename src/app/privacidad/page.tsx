import { snapshot } from "@/lib/repository";
import { isDemo } from "@/lib/config";
import { Header, Footer } from "@/components/public";
export const dynamic = "force-dynamic";
export const metadata = { title: "Aviso de privacidad" };
export default async function Privacy() {
  const { settings: s } = await snapshot();
  return (
    <>
      <Header settings={s} demo={isDemo()} />
      <main id="main" className="container legal-page">
        <span className="eyebrow">TU INFORMACIÓN, CON CUIDADO</span>
        <h1>Aviso de privacidad.</h1>
        {(!s.privacyName || !s.privacyEmail || !s.privacyAddress) && (
          <div className="legal-draft">
            Vista previa del aviso. Falta completar la identidad, el domicilio o
            el correo del responsable antes de iniciar la operación comercial.
          </div>
        )}
        <p>
          Responsable:{" "}
          {s.privacyName ||
            "Chivabonos Relampamigos — identidad del responsable pendiente de completar"}
          . {s.privacyAddress && `Domicilio: ${s.privacyAddress}.`} Contacto:{" "}
          {s.privacyEmail || `WhatsApp +${s.phone}`}.
        </p>
        <h2>Qué datos tratamos y para qué</h2>
        <p>
          Al consultar un partido se registra la selección de lugares, el total
          calculado y una referencia. Si envías el mensaje por WhatsApp, podemos
          recibir tu número, nombre que compartas, texto de la consulta y fecha
          del contacto. Guardamos los datos necesarios para coordinar el
          apartado, acordar el pago y la entrega, atender aclaraciones y
          proteger el inventario. No pedimos contraseñas de Boletomóvil, códigos
          QR ni datos completos de tarjetas bancarias.
        </p>
        <h2>Información técnica</h2>
        <p>
          El servicio puede procesar dirección IP y registros técnicos para
          prevenir abuso y resolver errores. Los límites de solicitudes utilizan
          una referencia derivada de la IP. No utilizamos herramientas de
          publicidad o analítica de terceros en esta versión. Las cookies de
          sesión se utilizan para el acceso de administradores.
        </p>
        <h2>Servicios que intervienen</h2>
        <p>
          La web utiliza Vercel para alojamiento y Supabase para base de datos,
          acceso del equipo y almacenamiento. WhatsApp y Meta procesan las
          conversaciones según sus propias condiciones y avisos. Boletomóvil
          gestiona la transferencia del acceso en su plataforma. Compartimos con
          esos servicios la información necesaria para las funciones descritas;
          no publicamos datos de compradores.
        </p>
        <h2>Tus derechos y contacto</h2>
        <p>
          Puedes solicitar acceso, rectificación, cancelación u oposición al
          tratamiento de tus datos, así como revocar tu consentimiento cuando
          corresponda, mediante el contacto del responsable indicado arriba.
          Describe tu solicitud y la referencia de consulta o apartado. Te
          indicaremos cómo verificar tu identidad sin pedir información
          innecesaria y el procedimiento aplicable.
        </p>
        <h2>Conservación y cambios</h2>
        <p>
          Conservamos la información necesaria para coordinar la operación,
          resolver aclaraciones y cumplir las obligaciones aplicables. Puedes
          solicitar la eliminación cuando ya no exista una razón para
          conservarla. Cualquier modificación a este aviso se publicará en esta
          misma página. Al abrir WhatsApp, la conversación se realiza también
          conforme al aviso de privacidad de ese servicio.
        </p>
        <p>
          <a
            href={`https://wa.me/${s.phone}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Contactar al responsable por WhatsApp
          </a>
        </p>
      </main>
      <Footer settings={s} />
    </>
  );
}
