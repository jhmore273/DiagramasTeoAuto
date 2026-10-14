window.addEventListener('load', function () {
  var storageKey = 'fsm-notebooks-v1';
  var picker = document.getElementById('canvas-list');
  var undoButton = document.getElementById('undo');
  var labelSideButton = document.getElementById('label-side');
  var saveStatus = document.getElementById('save-status');
  var viewport = document.getElementById('viewport');
  var histories = {};
  var gestureBefore = null;
  var loading = false;
  var book;
  try {
    book = JSON.parse(localStorage.getItem(storageKey));
    if (!book || !Array.isArray(book.items) || !book.items.length || !book.items.every(function(item) {
      return typeof item.id === 'string' && typeof item.name === 'string' && item.graph && Array.isArray(item.graph.nodes) && Array.isArray(item.graph.links);
    })) book = null;
  } catch (error) { book = null; }
  if (!book) {
    // Migrate the existing single diagram without clearing its legacy backup.
    book = {active: 'initial', items: [{id: 'initial', name: 'Lienzo 1', graph: getDiagramState(), width: canvas.width, height: canvas.height, left: 0, top: 0}]};
  }
  if (!book.items.some(function(item) { return item.id === book.active; })) book.active = book.items[0].id;

  function activeItem() { return book.items.find(function(item) { return item.id === book.active; }); }
  function history() { return histories[book.active] || (histories[book.active] = []); }
  function snapshot() { return JSON.stringify(getDiagramState()); }
  function persist() {
    if (loading) return;
    var item = activeItem();
    item.graph = getDiagramState();
    item.width = canvas.width;
    item.height = canvas.height;
    item.left = viewport.scrollLeft;
    item.top = viewport.scrollTop;
    try {
      localStorage.setItem(storageKey, JSON.stringify(book));
      saveStatus.textContent = 'Guardado en este equipo';
    } catch (error) {
      saveStatus.textContent = 'No se pudo guardar. Conserva la aplicación abierta y exporta tu diagrama.';
    }
  }
  function record(before) {
    if (before === snapshot()) return;
    history().push(before);
    if (history().length > 100) history().shift();
    undoButton.disabled = !history().length;
    persist();
  }
  function renderPicker() {
    picker.replaceChildren();
    book.items.forEach(function(item) {
      var row = document.createElement('div');
      row.className = 'canvas-row' + (item.id === book.active ? ' active' : '');
      var open = document.createElement('button');
      open.className = 'canvas-open';
      open.textContent = item.name;
      open.title = item.name;
      open.setAttribute('aria-pressed', String(item.id === book.active));
      open.onclick = function() {
        if (book.active === item.id) return;
        persist();
        book.active = item.id;
        loadItem();
      };
      var rename = document.createElement('button');
      rename.className = 'canvas-action';
      rename.textContent = '✎';
      rename.title = 'Renombrar ' + item.name;
      rename.setAttribute('aria-label', rename.title);
      rename.onclick = function() { renameItem(item); };
      var remove = document.createElement('button');
      remove.className = 'canvas-action canvas-delete';
      remove.textContent = '×';
      remove.title = 'Borrar ' + item.name;
      remove.setAttribute('aria-label', remove.title);
      remove.onclick = function() { deleteItem(item); };
      row.append(open, rename, remove);
      picker.appendChild(row);
    });
    undoButton.disabled = !history().length;
  }
  function resetOutput() {
    document.getElementById('output').value = '';
    document.getElementById('output').style.display = 'none';
    document.getElementById('output-label').hidden = true;
  }
  function loadItem() {
    loading = true;
    clearInterval(caretTimer);
    gestureBefore = null;
    var item = activeItem();
    restoreDiagramState(item.graph);
    canvas.width = Number.isInteger(item.width) && item.width >= 800 && item.width <= 16384 ? item.width : 800;
    canvas.height = Number.isInteger(item.height) && item.height >= 600 && item.height <= 16384 ? item.height : 600;
    try { localStorage.setItem('fsm-canvas-size', JSON.stringify({width: canvas.width, height: canvas.height})); } catch (error) {}
    resetOutput();
    draw();
    window.dispatchEvent(new Event('resize'));
    viewport.scrollLeft = item.left || 0;
    viewport.scrollTop = item.top || 0;
    loading = false;
    renderPicker();
    persist();
  }
  var legacySave = saveBackup;
  saveBackup = function () {
    legacySave();
    persist();
    labelSideButton.disabled = !selectedObject || selectedObject instanceof Node;
  };
  labelSideButton.onclick = function() {
    if (!selectedObject || selectedObject instanceof Node) return;
    var before = snapshot();
    selectedObject.textBelow = !selectedObject.textBelow;
    draw();
    record(before);
    canvas.focus({preventScroll: true});
  };

  // Record an entire drag as one action, regardless of mousemove count.
  var mouseDown = canvas.onmousedown;
  canvas.onmousedown = function(e) {
    canvas.focus({preventScroll: true});
    gestureBefore = snapshot();
    return mouseDown.call(this, e);
  };
  var mouseUp = canvas.onmouseup;
  canvas.onmouseup = function(e) {
    var result = mouseUp.call(this, e);
    if (gestureBefore !== null) record(gestureBefore);
    gestureBefore = null;
    return result;
  };
  // Finalize edits even when the pointer is released outside the drawing surface.
  document.addEventListener('mouseup', function(e) {
    if (gestureBefore !== null && e.target !== canvas) canvas.onmouseup(e);
  });
  window.addEventListener('blur', function() {
    if (gestureBefore !== null) record(gestureBefore);
    gestureBefore = null;
  });
  var doubleClick = canvas.ondblclick;
  canvas.ondblclick = function(e) {
    var before = snapshot();
    var result = doubleClick.call(this, e);
    record(before);
    return result;
  };
  function undo() {
    if (gestureBefore !== null) { record(gestureBefore); gestureBefore = null; }
    if (!history().length) return;
    restoreDiagramState(JSON.parse(history().pop()));
    clearInterval(caretTimer);
    resetOutput();
    draw();
    undoButton.disabled = !history().length;
    canvas.focus({preventScroll: true});
  }
  undoButton.onclick = undo;
  var keyDown = document.onkeydown;
  document.onkeydown = function(e) {
    var target = e.target;
    var isInput = target && (target.matches('input, textarea, select') || target.isContentEditable);
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key || '').toLowerCase() === 'z' && !isInput) {
      e.preventDefault();
      undo();
      return false;
    }
    var before = snapshot();
    var result = keyDown.call(this, e);
    record(before);
    return result;
  };
  var keyPress = document.onkeypress;
  document.onkeypress = function(e) {
    var before = snapshot();
    var result = keyPress.call(this, e);
    record(before);
    return result;
  };
  var clearAll = document.getElementById('clear-all').onclick;
  document.getElementById('clear-all').onclick = function(e) {
    var before = snapshot();
    clearAll.call(this, e);
    record(before);
  };
  function deleteItem(item) {
    if (!window.confirm('¿Borrar el lienzo "' + item.name + '"?\n\nSe eliminará este lienzo guardado y su diagrama. No se puede deshacer. Los demás lienzos se conservarán.')) return;
    persist();
    var index = book.items.findIndex(function(entry) { return entry.id === item.id; });
    if (index < 0) return;
    var wasActive = book.active === item.id;
    book.items.splice(index, 1);
    delete histories[item.id];
    if (!book.items.length) {
      book.items.push({id: crypto.randomUUID(), name: 'Lienzo 1', graph: {nodes: [], links: []}, width: 800, height: 600, left: 0, top: 0});
    }
    if (wasActive) {
      book.active = book.items[Math.min(index, book.items.length - 1)].id;
      loadItem();
    } else {
      renderPicker();
      persist();
    }
  }
  function askName(title, initial) {
    var dialog = document.getElementById('name-dialog');
    var input = document.getElementById('canvas-name');
    document.getElementById('name-title').textContent = title;
    input.value = initial;
    dialog.returnValue = '';
    document.getElementById('cancel-name').onclick = function() { dialog.close('cancel'); };
    return new Promise(function(resolve) {
      dialog.onclose = function() { resolve(dialog.returnValue === 'save' ? input.value : null); };
      dialog.showModal();
      input.select();
    });
  }
  document.getElementById('new-canvas').onclick = async function() {
    var name = await askName('Nuevo lienzo', 'Lienzo ' + (book.items.length + 1));
    if (name === null || !name.trim()) return;
    persist();
    var item = {id: crypto.randomUUID(), name: name.trim().slice(0, 80), graph: {nodes: [], links: []}, width: 800, height: 600, left: 0, top: 0};
    book.items.push(item);
    book.active = item.id;
    loadItem();
    canvas.focus({preventScroll: true});
  };
  async function renameItem(item) {
    var name = await askName('Renombrar lienzo', item.name);
    if (name === null || !name.trim()) return;
    item.name = name.trim().slice(0, 80);
    renderPicker();
    persist();
  }
  viewport.addEventListener('scroll', persist);
  window.addEventListener('resize', persist);
  window.addEventListener('beforeunload', persist);
  loadItem();
});
