# Configuración de producción

El proyecto está preparado para configurarse. Este trabajo no publica la web ni da de alta servicios reales.

## Supabase

1. Crear un proyecto del propietario y ejecutar `supabase/migrations/202611010001_initial.sql` en una base nueva. Con Supabase CLI se puede enlazar el proyecto y ejecutar `supabase db push`.
2. Configurar `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SERVICE_ROLE_KEY`. La clave service role se usa solo en servidor.
3. Desactivar el registro público de usuarios en Auth. Los compradores no necesitan cuenta.
4. Crear la primera cuenta del propietario en Supabase Auth, con contraseña robusta. Agregarla a la lista de administradores con el SQL siguiente, cambiando el correo por el real:

```sql
insert into public.admin_accounts(user_id,email,role,active)
select id,email,'owner',true from auth.users where lower(email)=lower('propietario@ejemplo.com')
on conflict(user_id) do update set role='owner',active=true;
```

5. En Auth, configurar Site URL y las URL permitidas de redirección hacia `https://tu-dominio/auth/callback` y la variante con `?next=/admin/password`.
6. Configurar SMTP para invitaciones y, en la plantilla de invitación, usar un enlace con token hash hacia:

```html
<a
  href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite&next=/admin/password"
  >Aceptar invitación y definir contraseña</a
>
```

7. Comprobar una invitación real y la desactivación de una cuenta. La autorización de cada operación consulta `admin_accounts.active`; tener una sesión de Auth por sí solo no permite editar.
8. Verificar que `seat_inventory` está en la publicación `supabase_realtime`. La migración lo agrega cuando esa publicación existe.

El bucket `site-media` es privado. Los originales de nuevas cargas no se conservan: se re-encodea la imagen en JPEG, sin EXIF. Una imagen cargada comienza oculta. El servidor solo entrega imágenes publicadas o solicita una sesión administrativa para los borradores. La revisión humana sigue siendo necesaria para detectar QR y datos visibles en la imagen.

## Meta y WhatsApp

La integración usa Cloud API oficial. Se necesitan un portafolio comercial de Meta, una aplicación con WhatsApp, una WABA y un número registrado. El propietario debe completar la conexión del número 3314581203 y verificar la modalidad disponible si también usa la app WhatsApp Business. No es necesario borrar la app para desarrollar: primero se puede usar el número de prueba de Meta.

Variables:

| Variable                 | Uso                                                                    |
| ------------------------ | ---------------------------------------------------------------------- |
| WHATSAPP_PHONE           | Número internacional visible, inicialmente 523314581203                |
| WHATSAPP_PHONE_NUMBER_ID | ID del número registrado en Meta                                       |
| WHATSAPP_WABA_ID         | Referencia de la cuenta comercial, útil para el alta                   |
| WHATSAPP_ACCESS_TOKEN    | Token de sistema con permisos mínimos para la integración              |
| WHATSAPP_APP_SECRET      | Validación de la firma de cada POST recibido                           |
| WHATSAPP_VERIFY_TOKEN    | Valor aleatorio para el desafío inicial del webhook                    |
| WHATSAPP_GRAPH_VERSION   | Versión vigente y habilitada de Graph API, con formato vNN.N           |
| WHATSAPP_MODE            | `disabled` hasta terminar las pruebas; después `live`                  |
| WHATSAPP_STATUS_TEMPLATE | Plantilla utility aprobada para avisos fuera de la ventana de servicio |

Configurar callback `https://tu-dominio/api/whatsapp/webhook`, verificar el token y suscribirse al campo `messages` de la WABA. Los mensajes entrantes deben corresponder al `phone_number_id` esperado. Los POST se verifican sobre el cuerpo original con `X-Hub-Signature-256`.

La plantilla opcional de estado debe usar idioma `es_MX` y un parámetro de texto en el cuerpo. Su contenido y categoría deben aprobarse en Meta. Sin una plantilla, el sistema deja para revisión los avisos fuera de la ventana de servicio. No reintenta a ciegas respuestas inciertas, para evitar duplicar mensajes.

Los avisos se encolan en la misma transacción del cambio de inventario. Un proceso toma filas con bloqueo y lease para impedir que dos trabajadores envíen la misma fila simultáneamente. El éxito del cambio de inventario no depende del éxito de WhatsApp. El panel permite revisar y procesar los avisos.

Configurar un `CRON_SECRET` aleatorio para proteger `/api/cron/whatsapp`. Se intenta procesar la cola inmediatamente después de confirmar el cambio o recibir el webhook, usando `after` de Next.js. El ejemplo de Vercel añade una revisión diaria de respaldo; ajusta la frecuencia a la capacidad del plan si deseas reintentos más frecuentes. Los reintentos automáticos están limitados. El estado “enviado” significa aceptado por la API; no se presenta como garantía de lectura o de pago.

Antes de activar `live`, comprobar con números de prueba: llegada de consulta, duplicado de webhook, apartado, liberación, cierre de venta, fallo de entrega y plantilla fuera de ventana. El entorno construido no tiene credenciales para verificar esos envíos reales.

## Vercel

1. Guardar el proyecto en un repositorio privado del propietario.
2. Importarlo en Vercel como Next.js y seleccionar Node.js 24.
3. Configurar `DATA_MODE=supabase`, `SITE_URL` con el origen real y las variables anteriores. No copiar contraseñas o secretos de demostración.
4. Configurar el dominio y las redirecciones de Auth. `SITE_URL` debe coincidir con el origen desde el que los administradores editan; la API comprueba el origen de cada mutación.
5. Hacer una revisión privada de la versión y después solicitar autorización expresa para publicar. El usuario no ha autorizado despliegue público en esta tarea.

La demostración está bloqueada en `VERCEL_ENV=production`. Producción utiliza exclusivamente Supabase; no usa disco local como inventario.

## Información de negocio pendiente antes de operar

- Partidos y precios reales confirmados, capturados o importados y revisados antes de publicar.
- Datos reales del responsable del aviso de privacidad: nombre, domicilio y correo. Son editables desde el panel.
- Condiciones concretas de cancelación, reprogramación y reembolso que el vendedor informará antes del pago.
- Revisión de los términos aplicables al Chivabono CL27 y a cada evento, para confirmar las modalidades de transferencia y comercialización permitidas. La existencia de una función de transferencia no constituye por sí sola autorización de reventa.
- Derechos de uso de fotografías y emblemas que se publiquen. La versión usa la foto aportada por el propietario y una marca propia.

## Referencias consultadas

- [Cloud API — documentación oficial de Meta en Postman](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api)
- [WhatsApp Business y conexión con la plataforma](https://whatsappbusiness.com/resources/resource-library/organize-whatsapp-inbox-meta-business-suite/)
- [Información oficial de Chivas en Boletomóvil](https://www.boletomovil.com/chivas)
- [Ley Federal de Protección de Datos Personales en Posesión de los Particulares](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf)

Las páginas legales incluidas describen el tratamiento diseñado y el flujo de compra. No certifican por sí mismas el cumplimiento jurídico del vendedor ni sustituyen completar su información y condiciones reales.
