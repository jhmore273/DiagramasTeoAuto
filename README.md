# DiagramasTeoAuto

Diseñador de autómatas basado en Finite State Machine Designer de Evan Wallace (https://github.com/evanw/fsm), con licencia MIT.

## Abrir en línea

https://jhmore273.github.io/DiagramasTeoAuto/

No requiere instalación ni cuenta. Recomendado en un navegador de escritorio moderno con ratón y teclado. GitHub Pages publica la raíz de main. El archivo .nojekyll permite servir directamente los archivos estáticos.

## Funciones

- Interfaz negra, cuadrícula y estados opacos.
- Lienzo ampliado de al menos 2400 × 1600, vista adaptable, desplazamiento, pantalla completa y regreso al tamaño normal.
- Panel lateral para crear, abrir, renombrar y borrar lienzos con confirmación.
- Guardado automático por navegador y equipo, incluido el lienzo activo, tamaño y desplazamiento. Sin cuentas ni sincronización remota. Borrar los datos del sitio elimina el guardado local.
- Doble clic para crear estados o alternar aceptación; Shift y arrastrar para transiciones, flechas iniciales y bucles.
- Letras griegas (/lambda, /epsilon, /Delta o \lambda) y subíndices como S_0.
- Enter crea otra línea en las etiquetas de las flechas. Se sitúan arriba por defecto. Alt + L o Texto arriba/abajo cambia de lado la etiqueta seleccionada; Ctrl + L está reservado por el navegador.
- Retroceso borra letras y después elimina el estado o la flecha con etiqueta vacía. Supr elimina directamente el elemento seleccionado.
- Ctrl + Z, Command + Z o Deshacer revierte hasta 100 ediciones por lienzo durante la sesión, incluidos movimientos y Borrar todo.
- Borrar todo pide confirmación y solo afecta al lienzo activo.
- PNG, SVG y LaTeX se descargan con el nombre del lienzo: Diagrama_Tarea8_Problema1.png, .svg o .tex. SVG y LaTeX también muestran el texto para copiarlo. El navegador determina la carpeta de descarga.

Los lienzos de la aplicación de escritorio son independientes de los del navegador. La cuadrícula es una ayuda visual del editor y no aparece en las exportaciones.

## Desarrollo

src/ contiene el editor y sus exportadores. Ejecuta node build.cjs para regenerar fsm.js. workspace.js gestiona la vista y notebooks.js gestiona los lienzos y el historial. Todas las rutas son relativas para funcionar en GitHub Pages.

Se conserva la licencia MIT y la atribución del proyecto original. Estas actualizaciones no se sometieron a pruebas automáticas por solicitud del propietario.
