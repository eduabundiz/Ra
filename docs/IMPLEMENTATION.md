# Plan de implementación

1. Sistema visual editorial original, marca Relampamigos y fotografía real proporcionada.
2. Inicio, catálogo, detalle, selección de grupos e individuales y enlaces contextuales de WhatsApp.
3. Repositorio demo persistente para presentación y repositorio Supabase para producción.
4. Panel protegido, partidos/precios, disponibilidad, reservas, entrega, galería y administradores.
5. Excel con plantilla, validación y vista previa antes de importar.
6. Migraciones con RLS y cambios de inventario atómicos, auditoría e idempotencia.
7. Webhook firmado de Meta, correlación de solicitudes y cola de avisos de WhatsApp.
8. Revisión visual en tres tamaños, pruebas de dominio, integración y navegador, lint y build.

El usuario autoriza desarrollo y pruebas. La publicación pública y el alta de servicios reales requieren configuración posterior. El panel decide las reservas: una consulta de WhatsApp no bloquea inventario. Las reservas se revisan a los 30 minutos y se liberan manualmente.
