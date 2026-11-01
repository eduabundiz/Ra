# Reporte de pruebas

Versión de presentación: 1.0.0. Revisión del 31 de octubre de 2026, hora de Guadalajara.

## Resultado

| Comprobación | Resultado |
|---|---|
| TypeScript (`npm run typecheck`) | Correcto |
| ESLint (`npm run lint`) | Correcto, sin errores ni advertencias del código |
| Pruebas unitarias e integración (`npm test`) | 19 de 19 correctas |
| Pruebas completas de navegador (`npm run test:e2e`) | 6 de 6 correctas |
| Compilación con configuración de producción | Correcta |
| Producción sin datos (`npm run check:empty`) | Correcto: vacío real, sin muestras, panel protegido |
| Auditoría de dependencias de producción | 0 vulnerabilidades conocidas reportadas por npm audit |

## Cobertura comprobada

- Exactitud de los diez asientos y sus secciones, filas y números.
- Precios por grupo e individuales calculados en servidor, interruptor de individuales y rechazo de selecciones inventadas o duplicadas.
- Superposición B3/B5: una reserva impide reservar de nuevo esos mismos lugares.
- Inventario independiente para cada partido.
- Confirmación de venta sujeta a pago verificado y transferencia completada. Control de versiones y rechazo de cambios incompatibles.
- Liberación manual: el plazo orientativo no libera inventario por sí solo.
- Proyección pública sin nombres, teléfonos de compradores, reservas privadas, borradores, auditoría o avisos.
- Migración SQL ejecutada en PostgreSQL mediante PGlite, creación automática de los diez lugares y restricciones RLS.
- Rechazo de accesos anónimos a información privada y a la función que cambia inventario.
- Webhook firmado sobre el cuerpo original, rechazo de firmas inválidas, idempotencia y correlación de referencias.
- Una consulta de WhatsApp deja los asientos disponibles hasta que el administrador confirma el apartado.
- Dos solicitudes simultáneas para apartar los mismos asientos: una correcta y una rechazada, sin duplicar inventario en el modo de presentación.
- Plantilla Excel vacía, importación con vista previa, fecha y hora de Guadalajara, centavos exactos, rechazo de fórmulas y fechas inexistentes.
- Publicación de borradores importados y desactivación de la venta individual.
- Fotografía cargada inicialmente privada; revisión explícita antes de publicación. Un visitante recibe 404 para una imagen en borrador. SVG disfrazado de JPEG rechazado.
- Protección de mutaciones contra origen externo.
- Inicio, catálogo y detalle en 1440 × 1000, 820 × 1180 y 390 × 844. Panel en escritorio y móvil. Sin desbordamiento horizontal de página en los tamaños comprobados.
- Análisis automatizado de accesibilidad con axe, WCAG 2 A/AA y 2.1 AA, sin infracciones detectadas en las páginas analizadas. No equivale a una certificación de accesibilidad completa.
- Inspección visual de capturas reales de inicio, detalle y panel. La navegación móvil y la selección individual se probaron en navegador.
- Verificación de que las dos imágenes base publicadas no contienen EXIF.

## Correcciones realizadas durante la revisión

Se aumentó el contraste de textos secundarios y etiquetas del esquema. Se corrigió el ancho mínimo del panel móvil para que la navegación lateral se desplazara dentro de su espacio, sin ensanchar toda la página. Se protegió la inicialización de datos locales contra lecturas simultáneas. Se actualizó el procesamiento de imágenes y se sustituyeron dependencias de Excel para eliminar avisos de seguridad en producción.

## Qué requiere comprobar cuentas reales

El entorno no tiene credenciales de Supabase, Meta, correo o Vercel. Por tanto, este reporte no afirma que se hayan enviado mensajes o correos reales ni que la aplicación esté desplegada.

Pendiente al conectar las cuentas del propietario:

1. Aplicar la migración a un proyecto Supabase alojado; comprobar inicio de sesión, invitación y desactivación de dos cuentas reales. Las operaciones de inventario y sus RLS se verificaron en PostgreSQL local, no mediante Supabase alojado.
2. Probar la concurrencia con dos administradores en ese proyecto. El SQL usa bloqueos de fila y control de versión; la prueba simultánea de navegador utiliza el repositorio local de demostración.
3. Verificar suscripción de webhooks de la WABA y recepción desde el número real registrado.
4. Verificar que Meta acepta los avisos, su entrega al destinatario y la plantilla aprobada fuera de la ventana de servicio. La cola se simuló localmente.
5. Configurar el dominio canónico, variables seguras y ejecución programada. Revisar la versión desplegada de forma privada antes de autorizar publicación pública.
6. Completar la identidad del responsable y las condiciones concretas de cancelación, reprogramación y reembolso; confirmar las condiciones aplicables al Chivabono CL27.

## Reproducir

```bash
npm ci
npm run setup:demo
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run check:empty
npm audit --omit=dev --audit-level=moderate
```

En el entorno Linux de construcción se utilizó Chromium empaquetado con `USE_BUNDLED_CHROMIUM=1`. Cada prueba abre su propio contexto y navegador para evitar restricciones del entorno de ejecución. El modo normal usa el Chromium de Playwright.

Los datos y credenciales ficticios de las pruebas solo sirven para esas pruebas. No se trasladan a producción. Los registros locales de navegador y sus capturas se mantienen fuera del paquete de código entregado.
