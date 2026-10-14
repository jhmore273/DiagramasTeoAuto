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

  book.folders = Array.isArray(book.folders) ? book.folders.filter(function(f) { return f && typeof f.id === 'string' && typeof f.name === 'string'; }) : [];
  book.folders.forEach(function(f) { if(!book.folders.some(function(parent) { return parent.id === f.parent; })) f.parent = null; });
  book.items.forEach(function(item) { if(!book.folders.some(function(f) { return f.id === item.folder; })) item.folder = null; });
  var currentFolder = book.items.find(function(item) { return item.id === book.active; }).folder || null;

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
  function canvasRow(item) {
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

    return row;
  }
  function renderPicker() {
    picker.replaceChildren();
    renderFolders();
    book.items.filter(function(item) { return (item.folder || null) === currentFolder; }).forEach(function(item) { picker.appendChild(canvasRow(item)); });
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
    currentFolder = item.folder || null;
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
    var item = {id: crypto.randomUUID(), name: name.trim().slice(0, 80), folder: currentFolder, graph: {nodes: [], links: []}, width: 800, height: 600, left: 0, top: 0};
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
  function folderName(id) {
    var names = [], visited = new Set();
    while(id && !visited.has(id)) {
      visited.add(id);
      var folder = book.folders.find(function(f) { return f.id === id; });
      if(!folder) break;
      names.unshift(folder.name);
      id = folder.parent;
    }
    return names.join(' / ');
  }
  function actionButton(text, title, action) {
    var button = document.createElement('button');
    button.textContent = text;
    button.title = title;
    button.setAttribute('aria-label', title);
    button.onclick = action;
    return button;
  }
  function renderFolders() {
    var path = document.getElementById('folder-path');
    path.replaceChildren(actionButton('Inicio', 'Abrir carpeta principal', function() { currentFolder = null; renderPicker(); }));
    var ancestors = [], id = currentFolder, visited = new Set();
    while(id && !visited.has(id)) {
      visited.add(id);
      var folder = book.folders.find(function(f) { return f.id === id; });
      if(!folder) break;
      ancestors.unshift(folder);
      id = folder.parent;
    }
    ancestors.forEach(function(folder) {
      path.appendChild(actionButton('› ' + folder.name, folderName(folder.id), function() { currentFolder = folder.id; renderPicker(); }));
    });
    book.folders.filter(function(f) { return f.parent === currentFolder; }).forEach(function(folder) {
      var row = document.createElement('div'); row.className = 'canvas-row folder-row';
      var open = actionButton('▸ ' + folder.name, 'Abrir carpeta ' + folder.name, function() { currentFolder = folder.id; renderPicker(); });
      open.className = 'canvas-open';
      var rename = actionButton('✎', 'Renombrar carpeta ' + folder.name, async function() {
        var name = await askName('Renombrar carpeta', folder.name);
        if(name === null || !name.trim()) return;
        folder.name = name.trim().slice(0, 80); persist(); renderPicker();
      }); rename.className = 'canvas-action';
      var remove = actionButton('×', 'Eliminar carpeta ' + folder.name, function() {
        if(!confirm('¿Eliminar la carpeta "' + folder.name + '"? Sus lienzos y subcarpetas se moverán a la carpeta superior, sin borrarlos.')) return;
        book.items.forEach(function(item) { if(item.folder === folder.id) item.folder = folder.parent; });
        book.folders.forEach(function(child) { if(child.parent === folder.id) child.parent = folder.parent; });
        book.folders = book.folders.filter(function(f) { return f.id !== folder.id; });
        persist(); renderPicker();
      }); remove.className = 'canvas-action canvas-delete';
      row.append(open, rename, remove); picker.appendChild(row);
    });
  }
  function cleanGraph(graph) {
    if(!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.links) || graph.nodes.length > 10000 || graph.links.length > 30000) throw new Error('Diagrama no válido.');
    function number(value, fallback) {
      if(value === undefined && fallback !== undefined) return fallback;
      if(typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Coordenadas no válidas.');
      return value;
    }
    function text(value) { if(typeof value !== 'string' || value.length > 100000) throw new Error('Etiqueta no válida.'); return value; }
    var nodes = graph.nodes.map(function(n) { return {x: number(n.x), y: number(n.y), text: text(n.text), isAcceptState: n.isAcceptState === true}; });
    function index(value) { if(!Number.isInteger(value) || value < 0 || value >= nodes.length) throw new Error('Una flecha apunta a un estado inexistente.'); return value; }
    var links = graph.links.map(function(l) {
      var result = {type: l.type, text: text(l.text), textBelow: l.textBelow === true};
      if(l.type === 'Link') {
        result.nodeA = index(l.nodeA); result.nodeB = index(l.nodeB);
        result.parallelPart = number(l.parallelPart, .5); result.perpendicularPart = number(l.perpendicularPart, 0); result.lineAngleAdjust = number(l.lineAngleAdjust, 0);
      } else if(l.type === 'SelfLink') { result.node = index(l.node); result.anchorAngle = number(l.anchorAngle, -Math.PI / 2); }
      else if(l.type === 'StartLink') { result.node = index(l.node); result.deltaX = number(l.deltaX, -80); result.deltaY = number(l.deltaY, 0); }
      else throw new Error('Tipo de flecha desconocido.');
      return result;
    });
    return {nodes: nodes, links: links};
  }
  function prepareImport(data, filename) {
    var incoming = data && data.format === 'DiagramasTeoAuto' ? data.book : data;
    if(data && data.format === 'DiagramasTeoAuto' && data.version !== 1) throw new Error('Versión de respaldo no compatible.');
    if(incoming && Array.isArray(incoming.nodes) && Array.isArray(incoming.links)) incoming = {items: [{id: 'single', name: filename.replace(/\.json$/i, ''), graph: incoming}]};
    if(!incoming || !Array.isArray(incoming.items) || !incoming.items.length || incoming.items.length > 1000) throw new Error('El JSON no contiene una colección de lienzos válida.');
    var folders = Array.isArray(incoming.folders) ? incoming.folders : [];
    if(folders.length > 1000) throw new Error('Demasiadas carpetas.');
    var map = new Map();
    folders.forEach(function(f) { if(!f || typeof f.id !== 'string' || typeof f.name !== 'string' || map.has(f.id)) throw new Error('Carpetas no válidas.'); map.set(f.id, crypto.randomUUID()); });
    var resultFolders = folders.map(function(f) { return {id: map.get(f.id), name: f.name.trim().slice(0, 80) || 'Carpeta', parent: map.get(f.parent) || null}; });
    resultFolders.forEach(function(f) {
      var visited = new Set([f.id]), parent = f.parent;
      while(parent) {
        if(visited.has(parent)) { f.parent = null; break; }
        visited.add(parent);
        var ancestor = resultFolders.find(function(candidate) { return candidate.id === parent; });
        parent = ancestor ? ancestor.parent : null;
      }
    });
    var importedActive = null;
    var items = incoming.items.map(function(item) {
      if(!item || typeof item.name !== 'string') throw new Error('Nombre de lienzo no válido.');
      var id = crypto.randomUUID();
      if(item.id === incoming.active) importedActive = id;
      return {id: id, name: item.name.trim().slice(0, 80) || 'Lienzo importado', folder: map.get(item.folder) || null, graph: cleanGraph(item.graph), width: Number.isInteger(item.width) && item.width >= 800 && item.width <= 16384 ? item.width : 800, height: Number.isInteger(item.height) && item.height >= 600 && item.height <= 16384 ? item.height : 600, left: Number.isFinite(item.left) ? Math.max(0, item.left) : 0, top: Number.isFinite(item.top) ? Math.max(0, item.top) : 0};
    });
    return {items: items, folders: resultFolders, active: importedActive || items[0].id};
  }
  function setupLibrary() {
    window.getActiveCanvasName = function() { return activeItem().name; };
    document.getElementById('new-folder').onclick = async function() {
      var name = await askName('Nueva carpeta en ' + (folderName(currentFolder) || 'Inicio'), 'Tarea 7');
      if(name === null || !name.trim()) return;
      var folder = {id: crypto.randomUUID(), name: name.trim().slice(0, 80), parent: currentFolder};
      book.folders.push(folder); currentFolder = folder.id; persist(); renderPicker();
    };
    document.getElementById('move-canvas').onclick = function() {
      var dialog = document.getElementById('move-dialog'), select = document.getElementById('move-destination');
      select.replaceChildren();
      [{id: '', name: 'Inicio'}].concat(book.folders.map(function(f) { return {id: f.id, name: folderName(f.id)}; })).forEach(function(f) {
        var option = document.createElement('option'); option.value = f.id; option.textContent = f.name; select.appendChild(option);
      });
      select.value = activeItem().folder || '';
      dialog.returnValue = '';
      document.getElementById('cancel-move').onclick = function() { dialog.close('cancel'); };
      dialog.onclose = function() { if(dialog.returnValue === 'move') { activeItem().folder = select.value || null; currentFolder = activeItem().folder; persist(); renderPicker(); } };
      dialog.showModal();
    };
    document.getElementById('export-library').onclick = function() {
      persist();
      var backup = {format: 'DiagramasTeoAuto', version: 1, exportedAt: new Date().toISOString(), book: book};
      downloadExport(JSON.stringify(backup, null, 2), 'application/json;charset=utf-8', 'json', 'DiagramasTeoAuto_Todos_' + new Date().toISOString().slice(0, 10) + '.json');
    };
    var input = document.getElementById('import-library-file');
    document.getElementById('import-library').onclick = function() { input.value = ''; input.click(); };
    input.onchange = async function() {
      if(!input.files.length) return;
      try {
        var file = input.files[0];
        if(file.size > 20 * 1024 * 1024) throw new Error('El JSON supera el límite de 20 MB.');
        var imported = prepareImport(JSON.parse(await file.text()), file.name);
        persist();
        var candidate = JSON.parse(JSON.stringify(book));
        candidate.items = candidate.items.concat(imported.items);
        candidate.folders = candidate.folders.concat(imported.folders);
        candidate.active = imported.active;
        // Commit atomically before changing the visible collection. A quota failure preserves the existing one.
        localStorage.setItem(storageKey, JSON.stringify(candidate));
        book = candidate; currentFolder = activeItem().folder || null; loadItem();
        alert('Se importaron ' + imported.items.length + ' lienzos. Los lienzos anteriores se conservaron.');
      } catch(error) { alert('No se pudo importar el JSON. No se reemplazaron tus lienzos.\n\n' + error.message); }
      input.value = '';
    };
  }

  setupLibrary();
  viewport.addEventListener('scroll', persist);
  window.addEventListener('resize', persist);
  window.addEventListener('beforeunload', persist);
  loadItem();
});
