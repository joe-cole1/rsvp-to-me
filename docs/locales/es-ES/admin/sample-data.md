---
title: Datos de ejemplo y capturas de pantalla
description: Cuentas de prueba de ejemplo, acceso en desarrollo y lista de capturas de escritorio.
category: Primeros pasos
audience: admin
order: 16
---

# Datos de ejemplo y capturas de pantalla {#sample-data-and-screenshots}

Usa los datos de ejemplo existentes para explorar una instancia de prueba local y capturar páginas con contenido. Esta guía parte de una instalación de prueba existente; para un despliegue normal, consulta la [Guía de instalación](installation.md).

## Cargar los datos de ejemplo {#load-the-sample-data}

El script de datos iniciales crea tres cuentas de organizadores, 20 invitados de ejemplo y 10 eventos con distintos temas y situaciones de gestión de invitados. Incluye respuestas de asistencia, cuestionarios, encuestas, aportaciones de comida, comentarios y registros de llegada.

| Cuenta            | Rol                             | Uso                                                                                                     |
| ----------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `host@test.com`   | Anfitrión, llamado Primary Host | Es propietario de los eventos de ejemplo; úsalo para las capturas del panel, los invitados y los temas. |
| `cohost@test.com` | Anfitrión                       | Es coanfitrión de algunos eventos de ejemplo.                                                           |
| `admin@test.com`  | Administrador                   | Permite explorar las herramientas de administración.                                                    |

Tanto las instalaciones desde el código como las versiones publicadas usan `SEED_TEST_DATA` de `.env`; el valor predeterminado es `false`. Con `false` o sin esta variable, el comando no escribe datos. En producción, `/setup` verifica la primera cuenta de administrador sin datos de ejemplo ni código de invitación. Se conservan los temas personalizados. Los datos de ejemplo solo se cargan si todavía no hay eventos.

Para cargar los datos explícitamente en un contenedor de prueba que ya esté ejecutándose desde el código fuente:

```bash
docker compose -f docker-compose.yml exec -e SEED_TEST_DATA=true app npm run db:seed
```

Selecciona el archivo de Compose correspondiente a tu entorno de prueba. Indicar explícitamente `-f docker-compose.yml` selecciona la configuración de contenedores sin cargar automáticamente la configuración adicional de WSL del mantenedor. En un entorno de desarrollo nativo, ejecuta `SEED_TEST_DATA=true npm run db:seed` desde el repositorio.

Si ya existen eventos, el script omite el conjunto de datos de ejemplo. Volver a ejecutarlo no actualiza las fechas de los eventos ni recrea las cuentas de ejemplo que falten. Conserva los datos existentes y usa una base de datos de prueba independiente si necesitas un conjunto nuevo.

## Iniciar sesión en la instancia de prueba {#sign-in-to-the-test-instance}

El registro de desarrollo requiere que `NODE_ENV` tenga un valor distinto de `production`. **La imagen publicada y el Dockerfile del repositorio se ejecutan en modo de producción**, incluso cuando contienen datos de ejemplo. Esos contenedores requieren un envío de correo funcional; `SEED_TEST_DATA=true` no activa el registro de los enlaces de acceso. Usa una aplicación de desarrollo local para acceder con las cuentas de prueba. Consulta [Configuración del correo electrónico](email.md#what-happens-without-email-configured) para conocer la diferencia.

Para una **aplicación de desarrollo ejecutándose en Docker**, solicita un enlace de acceso para `host@test.com` y consulta los registros del contenedor de la aplicación:

```bash
docker compose -f docker-compose.yml logs --since 10m app
```

Busca `[auth:magic-link-fallback] Magic link for host@test.com is:` y abre el enlace en el equipo que tenga acceso a la URL de tu aplicación local. Los enlaces caducan a los 15 minutos y solo pueden usarse una vez. El enlace se genera al solicitar el inicio de sesión; no es una credencial fija de los datos de ejemplo.

En el [entorno nativo opcional de WSL](local-development.md), consulta la terminal que ejecuta `npm run dev` en lugar de los registros de Docker.

## Lista de capturas de escritorio {#desktop-screenshot-checklist}

Usa `host@test.com` y los datos de eventos e invitados de ejemplo. Elige un evento publicado con una fecha de inicio futura y el plazo de respuesta abierto, para que los invitados puedan ver los controles de asistencia. Las fechas se calculan en relación con el momento en que se crearon los datos por primera vez; si es necesario, cambia la fecha de un evento de ejemplo desde los controles del anfitrión. Añade imágenes de portada antes de capturar la página de invitados y el panel, ya que el script no sube fotos de portada.

Sustituye `<slug>` por el identificador de la URL del evento. Por ejemplo, los datos incluyen `/e/launch-party-celebration`.

| Captura                  | Página y estado                                                      | Contenido                                                                                                                        | Ubicación en la documentación                                                                                                               |
| ------------------------ | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Página para invitados    | `/e/<slug>?preview=1`                                                | Imagen de portada, tema, título, fecha, ubicación y controles de asistencia. La vista previa oculta los controles del anfitrión. | README principal, página del evento para invitados                                                                                          |
| Panel del anfitrión      | `/dashboard`, con sesión de anfitrión iniciada                       | Tres o cuatro tarjetas de eventos de ejemplo con portadas, recuentos de asistencia y navegación.                                 | README principal, panel del anfitrión                                                                                                       |
| Gestión de invitados     | `/e/<slug>/guests`, con sesión de anfitrión iniciada                 | Resumen de asistencia, filtros, varios invitados de ejemplo y controles de llegada.                                              | [Guía de la lista de invitados](https://github.com/joe-cole1/rsvp-to-me/blob/main/docs/host/guest-list.md#guest-management-preview)         |
| Personalización del tema | `/e/<slug>/settings?section=theme`, con sesión de anfitrión iniciada | Temas predefinidos y controles de personalización.                                                                               | [Guía de personalización](https://github.com/joe-cole1/rsvp-to-me/blob/main/docs/host/customizing-your-page.md#theme-customization-preview) |

Captura archivos PNG con el zoom normal del navegador, los menús cerrados y sin incluir la interfaz del navegador. Una ventana de escritorio de unos 1440 × 1000 es un buen punto de partida. Mantén legible la columna estrecha del evento en lugar de reducir una captura de página completa muy larga. Las cuatro capturas de la documentación son vistas de escritorio.

Las capturas actuales están en `public/docs/images/`: `event-guest-view.png`, `host-dashboard.png`, `guest-management.png` y `theme-customization.png`. Para actualizarlas, sustituye la imagen correspondiente y revisa su texto alternativo y su pie. Mantén las rutas de las imágenes de Markdown relativas al documento para que funcionen en GitHub. El renderizador de las guías de la aplicación convierte las rutas de `public/docs/images/` en URL locales de `/docs/images/`. Comprueba ambas vistas antes de integrar una actualización.
