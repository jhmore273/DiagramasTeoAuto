window.addEventListener('load', function () {
  var editor = document.getElementById('editor');
  var viewport = document.getElementById('viewport');
  var large = document.getElementById('large');
  var normal = document.getElementById('normal');
  var fullscreen = document.getElementById('fullscreen');
  var expanded = false;
  var fullscreenError = '';
  try {
    var savedSize = JSON.parse(localStorage.getItem('fsm-canvas-size'));
    if (savedSize && Number.isInteger(savedSize.width) && Number.isInteger(savedSize.height) && savedSize.width >= 800 && savedSize.height >= 600 && savedSize.width <= 16384 && savedSize.height <= 16384) {
      canvas.width = savedSize.width;
      canvas.height = savedSize.height;
      draw();
    }
  } catch (error) { /* The diagram still works if size storage is unavailable. */ }

  function resize() {
    var wide = expanded || document.fullscreenElement === editor;
    // Never shrink the drawing surface: returning to normal is a viewport change.
    var width = Math.max(canvas.width, wide ? 2400 : 800, viewport.clientWidth);
    var height = Math.max(canvas.height, wide ? 1600 : 600, viewport.clientHeight);
    if (width !== canvas.width || height !== canvas.height) {
      canvas.width = width;
      canvas.height = height;
      draw();
    }
    try { localStorage.setItem('fsm-canvas-size', JSON.stringify({width: width, height: height})); } catch (error) { /* Optional view persistence. */ }
    large.setAttribute('aria-pressed', String(expanded));
    fullscreen.setAttribute('aria-pressed', String(document.fullscreenElement === editor));
    fullscreen.textContent = document.fullscreenElement === editor ? 'Salir de pantalla completa' : 'Pantalla completa';
    document.getElementById('status').textContent = (wide ? 'Lienzo ampliado' : 'Vista normal') + ' · ' + width + ' × ' + height + ' · Usa las barras para desplazarte.' + fullscreenError;
  }
  large.onclick = function () {
    expanded = true;
    document.body.classList.add('expanded');
    resize();
  };
  normal.onclick = async function () {
    try {
      if (document.fullscreenElement === editor) await document.exitFullscreen();
      expanded = false;
      document.body.classList.remove('expanded');
      resize();
    } catch (error) {
      fullscreenError = ' No se pudo salir de pantalla completa; usa Esc.';
      resize();
    }
  };
  fullscreen.onclick = async function () {
    fullscreenError = '';
    try {
      if (document.fullscreenElement === editor) await document.exitFullscreen();
      else if (editor.requestFullscreen) await editor.requestFullscreen();
      else throw new Error('Fullscreen unavailable');
    } catch (error) {
      large.click();
      fullscreenError = ' Pantalla completa no disponible; se activó el lienzo ampliado.';
    }
    resize();
  };
  document.addEventListener('fullscreenchange', resize);
  window.addEventListener('resize', resize);
  new ResizeObserver(resize).observe(viewport);
  document.getElementById('png').onclick = saveAsPNG;
  document.getElementById('svg').onclick = function () { saveAsSVG(); document.getElementById('output-label').hidden = false; };
  document.getElementById('latex').onclick = function () { saveAsLaTeX(); document.getElementById('output-label').hidden = false; };
  resize();
});
