# IAbrian
Chat de texto en español con inferencia local en el navegador, sin API de pago ni servidor de inferencia.

## Usar
Serví la raíz con HTTPS o localhost. Para desarrollo con Python 3:
```sh
python3 -m http.server 8080
```
Abrí http://localhost:8080, pulsá **Activar IA**, esperá la descarga y escribí.
No abrir index.html con file://: los módulos y WebGPU necesitan un origen adecuado.

## Publicar con GitHub Pages
En el repositorio, **Settings → Pages → Build and deployment → Deploy from a branch → main → /(root) → Save**.
La URL prevista es https://cuentar57-cmd.github.io/IAbrian/; solo funcionará cuando Pages esté activado y termine de publicar.
Esta entrega no activa Pages ni contrata servicios. La app usa rutas relativas y no necesita compilación.
Verificar disponibilidad y límites del plan antes de publicar: https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages
El costo de inferencia por API es cero. El alojamiento y la distribución de archivos dependen de límites y políticas de terceros, por lo que no se garantiza disponibilidad gratuita ilimitada.

## Implementación
- HTML, CSS y módulos JavaScript sin build.
- WebLLM fijado a 0.2.85, cargado desde esm.run. Modelo Qwen2.5-0.5B-Instruct del catálogo de esa versión; selecciona q4f16_1 con shader-f16 y q4f32_1 si falta esa capacidad.
- Worker de módulo para no bloquear la interfaz.
- Descarga voluntaria, progreso, cancelación, timeout de carga y recuperación ante errores.
- Historial local (hasta 30 chats y 100 mensajes por chat), borrar historial, copiar y detener.
- Contenido como texto, sin interpretar HTML del usuario o del modelo.
- Contexto reciente limitado por bytes, con ventana 4096 y respuesta máxima 512 tokens.
- Sin cuentas, base de datos, sincronización, subida de archivos.

## Requisitos y privacidad
Necesita WebGPU, controladores y memoria suficientes. Detectar WebGPU no garantiza que el modelo pueda ejecutarse en todos los equipos. La descarga es de cientos de MB y el modelo requiere memoria adicional. Su calidad es limitada, especialmente frente a modelos grandes.
Los mensajes se procesan localmente y se guardan en localStorage. Si se activa la búsqueda web opcional, se envía el tema indicado o la pregunta actual a Tavily; nunca el historial. Los proveedores de archivos externos reciben información de conexión. No hay analítica ni API remota de conversación.
Borrar historial no borra la caché del modelo: usar la configuración de datos del sitio del navegador. No se garantiza funcionamiento sin conexión; el motor y la página aún dependen de recursos externos.
En dispositivos compartidos, otros usuarios del mismo perfil de navegador pueden leer el historial.

## Verificación
```sh
npm test
npm run check
```
Prueba manual real pendiente en GPU compatible: carga completa, pregunta en español, respuesta, detención, recarga del historial y cancelación de descarga. Las pruebas simuladas de interfaz no verifican inferencia real.

## Fuentes y licencias de terceros
- WebLLM (Apache-2.0): https://github.com/mlc-ai/web-llm
- Documentación: https://webllm.mlc.ai/docs/
- Modelo original Qwen2.5-0.5B-Instruct: https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct
- Conversión MLC: https://huggingface.co/mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC
No se incluyen ni se vuelven a licenciar los pesos del modelo en este repositorio.

## Búsqueda web general
Activar **Buscar en la web**. El tema específico, si se indica, o la pregunta actual se envía a Tavily Search. No se envía el historial. Usa el modo oficial gratuito keyless, sin cuenta, clave, tarjeta ni facturación de API. Las respuestas se generan localmente con los extractos recuperados.

Se solicitan cuatro resultados de búsqueda general (sin restricción de dominios) y se usan hasta dos con URL válida y extracto, limitados por el contexto del modelo pequeño. Los enlaces y fragmentos se muestran debajo de la respuesta y persisten en el historial. No se accede a todas las páginas existentes, contenido privado ni necesariamente artículos completos. Una búsqueda exitosa no garantiza que la respuesta del modelo sea correcta o actual.

El proveedor aplica límites gratuitos no cuantificados aquí. Se muestran errores explícitos ante cuotas, rechazos, red y ausencia de resultados; nunca se activa una opción de pago ni se cambia silenciosamente a Wikipedia. Cancelación y timeout siguen disponibles.
Los chats antiguos con fuentes de Wikipedia conservan enlaces y atribución.

Verificado: petición OPTIONS con el origen https://cuentar57-cmd.github.io y encabezados de CORS, búsqueda HTTP real sin clave y pruebas automatizadas. La prueba completa de navegador + GPU local sigue pendiente.
- Acceso keyless y límites: https://docs.tavily.com/documentation/keyless
- API: https://docs.tavily.com/documentation/api-reference/endpoint/search

## Fechas y repreguntas
Cada consulta recibe la fecha y zona horaria del dispositivo (depende de que su reloj sea correcto). Las repreguntas breves pueden incluir la pregunta anterior del usuario en la búsqueda y en el contexto local; no se usan respuestas previas del modelo como evidencia. El aviso de privacidad refleja este cambio.
Las preguntas detectadas sobre próximos partidos requieren activar búsqueda web. No se responde con fechas desde la memoria del modelo. Se consulta el calendario desde la fecha local. La respuesta deportiva se retiene hasta validar que las fechas reconocidas sean futuras y estén presentes en los extractos. Si faltan fechas verificables, hay fechas pasadas o el partido es del mismo día sin estado confirmado, se muestra una respuesta de incertidumbre con los enlaces.
Esta comprobación conservadora no verifica semánticamente rival, competición o estado real del evento; no sustituye una API oficial de fixtures. No es entrenamiento del modelo y no garantiza que toda respuesta sea correcta.
