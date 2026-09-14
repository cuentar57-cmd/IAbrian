# IAbrian 2.0

Chat público en https://cuentar57-cmd.github.io/IAbrian/. Sitio estático en GitHub Pages, sin claves secretas ni API de pago. El modelo se ejecuta en el dispositivo del visitante mediante WebLLM 0.2.85.

## Uso

- **Automático:** usa búsquedas para preguntas detectadas sobre datos actuales. La detección es heurística; elegí **Buscar en la web** para forzar una consulta.
- **Buscar en la web:** consulta páginas de distintos sitios con Tavily keyless. Funciona incluso sin WebGPU. Sin modelo cargado muestra extractos identificados como tales; los calendarios compatibles pueden producir una respuesta estructurada con referencias.
- **Solo IA local:** permite conversar sin enviar la pregunta al buscador. Para consultas detectadas como actuales pide cambiar de modo.
- **Activar IA:** descarga voluntaria de Qwen2.5 1.5B por defecto; también 0.5B para equipos limitados y 3B para equipos con más memoria. La descarga puede superar 1 GB. Se elige precisión según soporte shader-f16. Recargá la página para cambiar de modelo después de cargarlo.

La primera descarga necesita conexión. Archivos en caché pueden reutilizarse, sujetos al navegador. WebGPU, memoria, batería y datos siguen siendo necesarios. No equivale a ChatGPT y no se entrenó un nuevo modelo.

## Cambios de esta versión

- Diseño móvil contenido, entrada de 16px para evitar zoom automático de iOS, controles compactos y fuentes/fragmentos plegables.
- Búsqueda independiente de la GPU, errores y cuotas explícitos, cancelar y volver a responder.
- Hasta cinco fuentes con extractos más extensos para conservar tablas. El contexto del modelo se reduce por separado a un presupuesto acotado.
- Contexto de repreguntas y cambio explícito de equipo. Las respuestas anteriores del modelo no son evidencia para la búsqueda.
- Lectura de calendarios con fechas ISO, d/m y meses en español, aunque sus tablas lleguen aplanadas. Requiere año explícito, asociación de fecha con rival y fila con hora; cita una fuente o señala corroboración por otro dominio. Rechaza rivales contradictorios para la misma fecha. Solo etiqueta la hora argentina cuando está indicada. Para un partido del mismo día requiere hora argentina futura respecto del reloj del dispositivo.
- Texto y código con un subconjunto seguro de Markdown. Nunca ejecuta HTML ni enlaces generados por el modelo. Los enlaces de fuentes se validan por separado.
- Conserva historial v1 y fuentes antiguas, con límites de 30 conversaciones y 100 mensajes por conversación. Si el almacenamiento está lleno o bloqueado lo informa.

## Límites importantes

No cubre todo internet. Tavily keyless es gratuito con límites variables; no hay cuota ilimitada garantizada. Se envía la consulta y, en repreguntas, contexto de hasta tres preguntas anteriores o el tema resuelto. Ver [documentación](https://docs.tavily.com/documentation/keyless) y [privacidad](https://www.tavily.com/privacy).

Los resultados son extractos, no artículos completos. El lector de calendarios reconoce formatos acotados; no es un proveedor oficial de resultados, no conoce suspensiones ni garantiza cobertura de todas las competiciones. Las fuentes pueden estar desactualizadas o equivocadas, y varios sitios pueden repetir el mismo error. El reloj del dispositivo debe ser correcto. Los modelos locales pequeños pueden equivocarse y tienen memoria de conversación limitada.

## Desarrollo y verificación

Sin compilación ni dependencias locales:

```sh
npm test
npm run check
npm start
```

`tests/browser.html` permite probar la interfaz real en anchos de 320, 390, 430 y 1280px. Las pruebas unitarias cubren fechas pasadas, tablas aplanadas, rivales contradictorios, cambio de equipo, zona horaria, presupuesto Unicode, cuotas, cancelación, enlaces peligrosos e historial.

Verificado en navegador: búsqueda real de River sin GPU y diseño con fuentes abiertas a 320/390px. El navegador de pruebas no dispone de GPU compatible; la descarga/inferencia de los modelos y el teclado de un iPhone físico requieren verificación en un dispositivo compatible. No se afirma que estas pruebas demuestren exactitud general del modelo.
