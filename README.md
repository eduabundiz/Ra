# Chivabonos Relampamigos

Sitio comercial en español para los diez lugares de Chivabono CL27 proporcionados por el propietario. Identidad original, sitio público adaptable, venta por grupos o individuales, contacto contextual por WhatsApp y administración sencilla.

## Ejecutar la presentación local

Requiere Node.js 24 y npm.

```bash
npm ci
npm run setup:demo
npm run dev
```

Abre http://localhost:3000. El comando de configuración muestra una contraseña aleatoria y la guarda en `.env.local`. El usuario local es `demo@relampamigos.local`. El panel está en http://localhost:3000/admin.

El modo demo utiliza partidos, fechas y precios de muestra identificados en pantalla. Los cambios persisten en `.data/local/`. Los avisos salientes de WhatsApp se simulan: no se envían mensajes reales. El enlace de contacto abre el número del negocio, pero el mensaje de un partido de muestra está marcado como demostración y el usuario debe enviarlo por su cuenta.

`setup:demo` no sobrescribe una configuración existente. Para reiniciar únicamente la demostración, detén el servidor y borra `.data/local/`. No borres ese directorio si deseas conservar los cambios de la presentación.

Para ejecutar la compilación de producción local:

```bash
npm run build
npm start
```

## Qué incluye

- Inicio, catálogo filtrable, página por partido, diagrama de asientos, fotografías, preguntas frecuentes, proceso de compra y contacto por WhatsApp.
- Paquetes A5, B5, B3 y B2. Precios independientes por paquete; venta individual habilitable por partido.
- Inventario de diez asientos por partido. Cambios atómicos y control de versiones para impedir modificaciones incompatibles.
- Panel con partidos, Excel, apartados, pago verificado, estado de transferencia, venta cerrada, consultas, fotografías, configuración y equipo.
- Supabase Auth, permisos propietario/editor, RLS, Storage privado y migración SQL.
- Cloud API: webhook firmado, referencias de consulta, recepción idempotente y cola de avisos. Realtime de Supabase con actualización de respaldo cada cinco segundos.
- Aviso de privacidad y condiciones editables en el código; datos del responsable configurables desde el panel.
- Pruebas de reglas de negocio, PostgreSQL/RLS y navegador. Ver [docs/TESTING.md](docs/TESTING.md).

## Inventario confirmado

| Grupo | Zona                      | Sección | Asientos                     |
| ----- | ------------------------- | ------- | ---------------------------- |
| A     | Lateral Inferior Poniente | T1-04   | S-15, S-16, S-17, S-18, S-19 |
| B     | Lateral Inferior Oriente  | T1-24   | R-10, R-11, R-12; Q-13, Q-14 |

El grupo A tiene cinco consecutivos. El grupo B tiene tres en R y dos en Q, en filas contiguas. Los grupos A y B se encuentran en ubicaciones diferentes. El esquema es orientativo y no representa distancias físicas.

Los identificadores provienen de las capturas aportadas por el propietario. La fotografía del estadio y el mapa general también fueron aportados por él. Las capturas completas del boleto y de la compra no se incluyen en los archivos públicos.

## Flujo de compra y sincronización

1. El visitante selecciona un paquete o asientos individuales permitidos.
2. El servidor vuelve a comprobar disponibilidad y calcula el precio desde los datos guardados; el navegador no decide el total.
3. Se crea una consulta con referencia `RL-…` y un enlace `wa.me` con partido, fecha local, modalidad, cantidad, lugares y total. Todavía no se bloquean asientos.
4. Cuando el cliente envía el mensaje, el webhook de Meta identifica la referencia. La consulta queda marcada como recibida y se registra el teléfono para contestar.
5. El administrador acuerda el apartado y lo registra en el panel. Esa sola operación actualiza todos los asientos y encola la confirmación de WhatsApp. El sitio se actualiza automáticamente.
6. El plazo orientativo es de treinta minutos, configurable. Un plazo vencido se señala para revisión; la reserva no se libera automáticamente.
7. El administrador registra el pago verificado y la transferencia por Boletomóvil. Cuando ambos pasos están completados, confirma la venta. El inventario queda vendido.
8. Si el acuerdo se cancela antes de cerrar la venta, el administrador libera el apartado y los asientos vuelven a estar disponibles.

Las decisiones sobre inventario se toman en el panel. No se interpreta conversación libre para reservar o vender. Una frase en un chat, una etiqueta en la app de WhatsApp o abrir el enlace no equivalen a un cambio de inventario.

La sincronización con WhatsApp no transfiere accesos por Boletomóvil ni valida pagos bancarios: esos dos pasos los verifica el vendedor.

## Conectar producción

Sigue [docs/PRODUCTION.md](docs/PRODUCTION.md). Copia `.env.example` como `.env.local` y completa las variables en un gestor seguro o en las variables de entorno de Vercel. No incluyas secretos en el repositorio ni los pegues en conversaciones.

La web no genera partidos de muestra en modo Supabase. Cuando no hay partidos publicados muestra “Pronto habrá partidos”. Una base de datos inaccesible produce un error recuperable; no se sustituye por inventario inventado.

No se ha publicado el proyecto ni se han creado cuentas externas.

## Importación de Excel

Panel → Partidos → Cargar Excel → Descargar plantilla. La plantilla también se genera desde `/api/admin/template` para administradores autenticados.

| Columna                           | Contenido                                             |
| --------------------------------- | ----------------------------------------------------- |
| clave                             | Identificador único con minúsculas, números y guiones |
| rival / competencia               | Datos confirmados                                     |
| fecha / hora                      | Texto `AAAA-MM-DD` y `HH:mm`, hora de Guadalajara     |
| grupo_a_5                         | Total de cinco lugares de Poniente, en pesos          |
| grupo_b_5 / grupo_b_3 / grupo_b_2 | Totales de cada paquete de Oriente                    |
| individual_a / individual_b       | Precio por asiento, si habilitas individuales         |
| permitir_individuales             | SI o NO                                               |

Máximo cien partidos por archivo `.xlsx` de hasta 2 MB. No se aceptan fórmulas. Hay validación, vista previa y confirmación. El lote se inserta como borradores y no modifica partidos existentes. Una clave duplicada rechaza el lote completo. Los precios se guardan como centavos enteros.

## Arquitectura

```text
src/app/                 Páginas y endpoints de Next.js
src/components/          Sitio público y panel
src/lib/domain.ts        Asientos, paquetes, precios y reglas de transición
src/lib/repository.ts    Acceso a demo o Supabase
src/lib/auth.ts          Autorización y sesión local
src/lib/whatsapp.ts      Firmas, mensajes, recepción y envío
src/lib/excel.ts         Plantilla, validación e importación
supabase/migrations/     Esquema, permisos, RLS y operaciones transaccionales
tests/                   Pruebas de dominio, SQL y navegador
docs/                    Operación, implementación y pendientes
```

El almacenamiento JSON y la exclusión dentro del proceso se usan únicamente para la demostración local. Producción usa las transacciones y los bloqueos de PostgreSQL. Supabase Realtime no expone nombres o teléfonos: la tabla de disponibilidad contiene solamente partido, asiento, estado y versión.

## Comandos de comprobación

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Las pruebas de navegador levantan su propio servidor en el puerto 3100 y usan `.data/e2e`, separada de la presentación local. La opción `USE_BUNDLED_CHROMIUM=1` se incluye para entornos Linux sin navegador instalado; en una computadora normal utiliza el Chromium instalado por Playwright.

## Diseño y marca

Paleta: rojo `#b5142c`, marfil `#f7f5ef`, tinta `#18221f`. Tipografías locales Barlow Condensed y DM Sans. Identidad original con monograma R y relámpago; no se utiliza el escudo oficial de Chivas. Procedencia y prompt de la marca en [docs/BRAND.md](docs/BRAND.md).

## Límites que requieren configuración real

El flujo local y los adaptadores se verifican con pruebas automatizadas. La entrega real de mensajes, los permisos de Meta, las invitaciones de correo y el acceso a un proyecto Supabase alojado requieren las cuentas y credenciales del propietario. El reporte distingue estas comprobaciones pendientes. Los textos legales necesitan completar la identidad del vendedor y confirmar las condiciones concretas de la operación antes de publicar.
