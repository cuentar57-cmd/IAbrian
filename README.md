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
- Sin cuentas, base de datos, sincronización, búsqueda web ni subida de archivos.

## Requisitos y privacidad
Necesita WebGPU, controladores y memoria suficientes. Detectar WebGPU no garantiza que el modelo pueda ejecutarse en todos los equipos. La descarga es de cientos de MB y el modelo requiere memoria adicional. Su calidad es limitada, especialmente frente a modelos grandes.
Los mensajes se procesan localmente y se guardan en localStorage. Los proveedores de archivos externos reciben información de conexión. No hay analítica ni API remota de conversación.
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
