---
title: Idiomas y contribuciones de traducción
description: Preferencias personales de idioma, idiomas de las notificaciones y cómo contribuir traducciones.
category: Configuración
audience: admin
order: 45
---

# Idiomas y contribuciones de traducción {#languages-and-translation-contributions}

## Elegir tu idioma {#choosing-your-language}

Usa el botón de idioma (un icono 文A con el código del idioma actual, por ejemplo ES) situado en la esquina superior derecha de la cabecera, justo al lado de tu perfil, en cualquier página, incluidas las pantallas de inicio de sesión y de acceso a eventos. Al elegir un idioma se conservan la URL actual y los valores introducidos en los formularios.

Si has iniciado sesión, la preferencia se guarda en tu cuenta y en este navegador. Si no has iniciado sesión, solo se guarda en la cookie de este navegador. La preferencia del navegador dura un año. La preferencia guardada en tu cuenta tiene prioridad sobre la del navegador. Tras iniciar sesión correctamente, una cuenta sin preferencia guardada adopta el idioma elegido explícitamente en el navegador. Solicitar un enlace de inicio de sesión o enviar una respuesta de asistencia como invitado nunca cambia el idioma de otra cuenta.

El inglés es el idioma predeterminado. El alemán aparece como **Deutsch** y el español como **Español** en el menú de idiomas. Las selecciones de idiomas no admitidos o eliminados vuelven al inglés. El idioma no se selecciona automáticamente a partir de las cabeceras de idioma del navegador. Los títulos, las descripciones y las preguntas de los eventos, los nombres y las notas de los invitados y el resto del contenido escrito por los usuarios se conservan tal como se escribieron. Las fechas usan el idioma de quien las consulta y la zona horaria del evento.

## Idiomas del correo electrónico y los SMS {#email-and-sms-languages}

Los correos electrónicos y mensajes de texto predeterminados del sistema usan el idioma guardado en la cuenta del destinatario. Los destinatarios desconocidos los reciben en inglés. Un mensaje de inicio de sesión puede usar el idioma seleccionado en el navegador que lo solicita si el destinatario no tiene un idioma guardado; esa elección no se guarda antes de verificar el inicio de sesión. Los mensajes de verificación de contacto del perfil usan el idioma del usuario que ha iniciado sesión. Las vistas previas y los mensajes de prueba del administrador usan el idioma seleccionado por el administrador.

Los mensajes escritos por los anfitriones y las plantillas de correo electrónico personalizadas por el administrador se conservan literalmente en todos los idiomas. La sustitución de marcadores existente sigue aplicándose a las plantillas personalizadas. Los comandos de SMS entrantes siguen siendo `YES`, `NO` y `MAYBE` en todos los idiomas.

Los recordatorios conservan los marcadores existentes de finalización por evento y tipo, así como el comportamiento de los resultados del envío. Si falla un lote de un idioma después de que se haya aceptado otro, un reintento puede repetir un lote ya aceptado. La localización no garantiza que cada mensaje se entregue exactamente una vez.

## Añadir un idioma {#adding-a-language}

Las traducciones se revisan mediante las solicitudes de cambios habituales. No hay carga de traducciones en tiempo de ejecución ni un servicio externo de traducción.

1. Elige un identificador de idioma BCP 47, como `fr-FR`.
2. Añade `messages/<locale>.json`. Sigue las claves anidadas de `messages/en-US.json`. Un idioma registrado debe traducir todas las claves: las pruebas de catálogos fallan si falta una clave o hay una desconocida. Durante la ejecución, una clave que aun así falte usa el inglés.
3. Registra el identificador en `messages/locales.json` con su `nativeName`, `dir` (`ltr` o `rtl`) y ruta `flag`. Añade el SVG de la bandera en `public/` y usa su URL alojada localmente. El registro controla el selector y la validación de idiomas admitidos; añadir un idioma no requiere cambios en los componentes ni en el esquema de la base de datos. El orden de las entradas en el archivo no importa: el menú siempre muestra primero el inglés y después el resto por orden alfabético de `nativeName`.
4. Usa mensajes ICU. Conserva exactamente los nombres de los parámetros y de las etiquetas de texto enriquecido. Mantén el significado de los mensajes, usa frases completas y plurales ICU e incluye la rama obligatoria `other`. No traduzcas los valores estables de las enumeraciones, las rutas, las variables de entorno ni los comandos. En texto ICU, escapa un apóstrofo literal situado antes de la sintaxis ICU con otro apóstrofo.
5. Si lo deseas, añade artículos de ayuda completos como se describe a continuación.
6. Ejecuta `npm test -- tests/lib/i18n* tests/lib/docs.test.ts tests/lib/docs-localization.test.tsx` y después `npm run test:components -- tests/components/DocsPanel.test.tsx`. La comprobación previa completa del repositorio sigue siendo obligatoria para el cambio integrado.

Los espacios de nombres de correo electrónico, SMS y recordatorios se usan solo en el servidor. Al navegador solo se envía el catálogo de la interfaz seleccionado. Cada idioma de `messages/locales.json` se publica con un catálogo completo, así que un cambio que añada textos en inglés debe añadir las mismas claves a cada idioma registrado.

## Traducir artículos de ayuda {#translating-help-articles}

Los artículos en inglés de `docs/admin/` y `docs/host/` definen los nombres de archivo, el orden y el público canónicos. Añade un artículo traducido en `docs/locales/<locale>/<audience>/<same-slug>.md`. Traduce su título, descripción, categoría y cuerpo completo. Si un artículo no está listo, no lo añadas: así se mostrará el artículo completo en inglés. El contenido de respaldo conserva su idioma y dirección de texto reales.

Cada encabezado traducido debe terminar con el ancla existente del encabezado correspondiente en inglés, por ejemplo `## Inloggen {#signing-in}`. El renderizador oculta ese marcador y mantiene el identificador canónico. No actives HTML sin procesar. Mantén intactos los destinos de los enlaces y las imágenes de Markdown; los enlaces traducidos también deben funcionar cuando su destino se muestre en inglés por falta de traducción. Conserva los bloques de código, los nombres de las variables de entorno, los comandos, las URL y los ejemplos escritos por los usuarios. Ejecuta las pruebas de documentación para comprobar los encabezados canónicos, los enlaces cruzados, las imágenes incluidas y el contenido de respaldo de los artículos.

El Dockerfile de producción copia todo el árbol `docs/`, incluidas las versiones traducidas. Los nuevos idiomas no requieren editar el Dockerfile.
