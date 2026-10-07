# DiagramasTeoAuto

Versión de [Finite State Machine Designer de Evan Wallace](https://github.com/evanw/fsm) para Teoría de Autómatas. Basada en el commit `fddf29aca27fa4b7a895d5894579e1f71688ba2b`; conserva licencia MIT, estados, transiciones, bucles, flechas iniciales, etiquetas, estados de aceptación y exportaciones PNG/SVG/LaTeX.

## Abrir

Abre `index.html` en un navegador de escritorio moderno o sirve esta carpeta con un servidor estático. No requiere instalación ni compilación. El guardado automático es local al navegador y al origen de la página; no sincroniza entre dispositivos.

## Controles nuevos

- **Ampliar lienzo**: la vista ocupa la ventana y el canvas crece a al menos 2400 × 1600 píxeles. Si la ventana es mayor, el canvas crece con ella.
- **Pantalla completa**: muestra el editor y sus herramientas en pantalla completa. Esc sale de este modo. Si el navegador no lo permite, se activa la vista ampliada y aparece un mensaje.
- **Tamaño normal**: sale de pantalla completa y devuelve la vista a 800 × 600 (limitada por el espacio disponible). El canvas nunca se reduce durante la sesión: puedes desplazarte a los estados que dibujaste lejos del origen.
- Redimensionar no mueve ni escala los estados. Las coordenadas del ratón contemplan desplazamiento y escalado visual.
- PNG descarga la imagen. SVG y LaTeX muestran su código para copiar.

## GitHub Pages

En **Settings → Pages → Build and deployment**, elige **Deploy from a branch**, rama **main** y carpeta **/(root)**. Guarda. Todos los archivos estáticos están incluidos y `.nojekyll` evita el procesamiento con Jekyll.

La URL prevista es `https://jhmore273.github.io/DiagramasTeoAuto/`. Solo estará disponible después de activar Pages y completar su despliegue. El repositorio público admite Pages con GitHub Free.

## Desarrollo y pruebas

`src/` contiene el código original con ajustes de coordenadas, foco y descarga PNG. `workspace.js` administra tamaño y pantalla completa. Después de cambiar `src/`, ejecuta `node build.cjs` para regenerar `fsm.js`.

Las pruebas de navegador están en `tests/browser.cjs`. Requieren Playwright y Chromium instalados: ejecuta `node tests/browser.cjs`. Verifican edición, tipos de transición, redimensionado, conservación, pantalla completa, exportaciones y recarga del guardado.
