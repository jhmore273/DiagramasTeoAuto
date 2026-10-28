var greekLetterNames = [ 'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi', 'Rho', 'Sigma', 'Tau', 'Upsilon', 'Phi', 'Chi', 'Psi', 'Omega' ];

function normalizeGreekShortcuts(text) {
	var names = greekLetterNames.concat(greekLetterNames.map(function(name) { return name.toLowerCase(); }));
	return text.replace(new RegExp('/(' + names.join('|') + ')(?![A-Za-z])', 'g'), function(match, name) { return '\\' + name; });
}

function convertLatexShortcuts(text) {
	text = normalizeGreekShortcuts(text);
	// html greek characters
	for(var i = 0; i < greekLetterNames.length; i++) {
		var name = greekLetterNames[i];
		text = text.replace(new RegExp('\\\\' + name, 'g'), String.fromCharCode(913 + i + (i > 16)));
		text = text.replace(new RegExp('\\\\' + name.toLowerCase(), 'g'), String.fromCharCode(945 + i + (i > 16)));
	}

	// subscripts
	for(var i = 0; i < 10; i++) {
		text = text.replace(new RegExp('_' + i, 'g'), String.fromCharCode(8320 + i));
	}

	return text;
}

function textToXML(text) {
	text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	var result = '';
	for(var i = 0; i < text.length; i++) {
		var c = text.charCodeAt(i);
		if(c >= 0x20 && c <= 0x7E) {
			result += text[i];
		} else {
			result += '&#' + c + ';';
		}
	}
	return result;
}

function drawArrow(c, x, y, angle) {
	var dx = Math.cos(angle);
	var dy = Math.sin(angle);
	c.beginPath();
	c.moveTo(x, y);
	c.lineTo(x - 8 * dx + 5 * dy, y - 8 * dy - 5 * dx);
	c.lineTo(x - 8 * dx - 5 * dy, y - 8 * dy + 5 * dx);
	c.fill();
}

function canvasHasFocus() {
	return document.activeElement === canvas || (document.activeElement || document.body) === document.body;
}

function drawText(c, originalText, x, y, angleOrNull, isSelected, textBelow) {
 var rawLines = originalText.split('\n');
 var originals = rawLines.map(normalizeGreekShortcuts);
 var caret = isSelected ? getLabelCaret() : -1;
 var lineStart = 0;
 var lines = originals.map(convertLatexShortcuts);
 var lineHeight = 24;
 c.font = '20px "Bahnschrift", "Segoe UI", sans-serif';
 var widths = lines.map(function(line) { return c.measureText(line).width; });
 var width = Math.max.apply(Math, widths);
 var halfHeight = 10 + (lines.length - 1) * lineHeight / 2;
 // Offset the entire label perpendicular to the arrow, clear of its line.
 if(angleOrNull != null) {
  var normalX = Math.cos(angleOrNull);
  var normalY = Math.sin(angleOrNull);
  // Prefer above for horizontal arrows and left for vertical arrows.
  if(normalY > 0.000001 || Math.abs(normalY) <= 0.000001 && normalX > 0) {
   normalX = -normalX;
   normalY = -normalY;
  }
  var distance = Math.abs(normalX) * width / 2 + Math.abs(normalY) * halfHeight + 8;
  var side = textBelow ? -1 : 1;
  x += side * normalX * distance;
  y += side * normalY * distance;
 }
 for(var i = 0; i < lines.length; i++) {
  var lineY = y + (i - (lines.length - 1) / 2) * lineHeight;
  if('advancedFillText' in c) {
   c.advancedFillText(lines[i], originals[i], x, lineY, null);
  } else {
   var lineX = Math.round(x - widths[i] / 2);
   lineY = Math.round(lineY);
   c.fillText(lines[i], lineX, lineY + 6);
   if(caret >= lineStart && caret <= lineStart + rawLines[i].length && isSelected && caretVisible && canvasHasFocus() && document.hasFocus()) {
    var caretX = lineX + c.measureText(convertLatexShortcuts(rawLines[i].slice(0, caret - lineStart))).width;
    c.beginPath();c.moveTo(caretX, lineY - 10);c.lineTo(caretX, lineY + 10);c.stroke();
   }
  }
  lineStart += rawLines[i].length + 1;
 }
}

var labelCaretOwner = null;
var labelCaretIndex = 0;
var labelPreferredColumn = null;

// Raw shortcut spans correspond to single visible Greek letters or subscripts.
function labelTextTokens(value) {
 var names = greekLetterNames.concat(greekLetterNames.map(function(name) { return name.toLowerCase(); }));
 var shortcut = new RegExp('^(?:\\\\(?:' + names.join('|') + ')|/(?:' + names.join('|') + ')(?![A-Za-z])|_[0-9])');
 var tokens = [];
 for(var start = 0; start < value.length;) {
  var remaining = value.slice(start);
  var match = remaining.match(shortcut);
  var length = match ? match[0].length : String.fromCodePoint(value.codePointAt(start)).length;
  tokens.push({start: start, end: start + length});
  start += length;
 }
 return tokens;
}

function getLabelCaret() {
 if(!selectedObject || !('text' in selectedObject)) return 0;
 if(labelCaretOwner !== selectedObject) {
  labelCaretOwner = selectedObject;
  labelCaretIndex = selectedObject.text.length;
  labelPreferredColumn = null;
 }
 labelCaretIndex = Math.min(Math.max(0, labelCaretIndex), selectedObject.text.length);
 labelTextTokens(selectedObject.text).forEach(function(token) {
  if(labelCaretIndex > token.start && labelCaretIndex < token.end) labelCaretIndex = token.end;
 });
 return labelCaretIndex;
}

function insertLabelText(value) {
 var index = getLabelCaret();
 selectedObject.text = selectedObject.text.slice(0, index) + value + selectedObject.text.slice(index);
 labelCaretIndex = index + value.length;
 labelPreferredColumn = null;
 getLabelCaret();
}

function eraseBeforeCaret() {
 var index = getLabelCaret();
 var tokens = labelTextTokens(selectedObject.text);
 var previous = tokens.filter(function(token) { return token.end <= index; }).pop();
 if(previous) {
  selectedObject.text = selectedObject.text.slice(0, previous.start) + selectedObject.text.slice(index);
  labelCaretIndex = previous.start;
 }
 labelPreferredColumn = null;
}

function moveLabelCaret(key, wholeText) {
 var index = getLabelCaret();
 var text = selectedObject.text;
 var tokens = labelTextTokens(text);
 if(key === 37 || key === 39) {
  if(key === 37) {
   var previous = tokens.filter(function(token) { return token.end <= index; }).pop();
   labelCaretIndex = previous ? previous.start : 0;
  } else {
   var next = tokens.find(function(token) { return token.start >= index; });
   labelCaretIndex = next ? next.end : text.length;
  }
  labelPreferredColumn = null;
  return;
 }
 var lines = text.split('\n');
 var starts = [0];
 for(var i = 1; i < lines.length; i++) starts[i] = starts[i - 1] + lines[i - 1].length + 1;
 var row = 0;
 while(row + 1 < starts.length && starts[row + 1] <= index) row++;
 if(key === 36 || key === 35) {
  labelCaretIndex = key === 36 ? (wholeText ? 0 : starts[row]) : (wholeText ? text.length : starts[row] + lines[row].length);
  labelPreferredColumn = null;
  return;
 }
 var currentTokens = labelTextTokens(lines[row]);
 if(labelPreferredColumn === null) labelPreferredColumn = currentTokens.filter(function(token) { return token.end <= index - starts[row]; }).length;
 var targetRow = Math.min(lines.length - 1, Math.max(0, row + (key === 38 ? -1 : 1)));
 var targetTokens = labelTextTokens(lines[targetRow]);
 var column = Math.min(labelPreferredColumn, targetTokens.length);
 labelCaretIndex = starts[targetRow] + (column ? targetTokens[column - 1].end : 0);
}

var caretTimer;
var caretVisible = true;

function resetCaret() {
	clearInterval(caretTimer);
	caretTimer = setInterval('caretVisible = !caretVisible; draw()', 500);
	caretVisible = true;
}

var canvas;
var nodeRadius = 30;
var nodes = [];
var links = [];

var cursorVisible = true;
var snapToPadding = 6; // pixels
var hitTargetPadding = 6; // pixels
var selectedObject = null; // either a Link or a Node
var currentLink = null; // a Link
var movingObject = false;
var originalClick;

function drawUsing(c) {
	c.clearRect(0, 0, canvas.width, canvas.height);
	c.save();
	c.translate(0.5, 0.5);

	for(var i = 0; i < links.length; i++) {
		c.lineWidth = 1;
		c.fillStyle = c.strokeStyle = (links[i] == selectedObject) ? 'blue' : 'black';
		links[i].draw(c);
	}
	if(currentLink != null) {
		c.lineWidth = 1;
		c.fillStyle = c.strokeStyle = 'black';
		currentLink.draw(c);
	}

	for(var i = 0; i < nodes.length; i++) {
		c.lineWidth = 1;
		c.fillStyle = c.strokeStyle = (nodes[i] == selectedObject) ? 'blue' : 'black';
		nodes[i].draw(c);
	}

	c.restore();
}

function draw() {
	drawUsing(canvas.getContext('2d'));
	saveBackup();
}

function selectObject(x, y) {
	for(var i = 0; i < nodes.length; i++) {
		if(nodes[i].containsPoint(x, y)) {
			return nodes[i];
		}
	}
	for(var i = 0; i < links.length; i++) {
		if(links[i].containsPoint(x, y)) {
			return links[i];
		}
	}
	return null;
}

function snapNode(node) {
	for(var i = 0; i < nodes.length; i++) {
		if(nodes[i] == node) continue;

		if(Math.abs(node.x - nodes[i].x) < snapToPadding) {
			node.x = nodes[i].x;
		}

		if(Math.abs(node.y - nodes[i].y) < snapToPadding) {
			node.y = nodes[i].y;
		}
	}
}

window.onload = function() {
	canvas = document.getElementById('canvas');
	restoreBackup();
	draw();

	canvas.onmousedown = function(e) {
		var mouse = crossBrowserRelativeMousePos(e);
		selectedObject = selectObject(mouse.x, mouse.y);
		movingObject = false;
		originalClick = mouse;

		if(selectedObject != null) {
			if(shift && selectedObject instanceof Node) {
				currentLink = new SelfLink(selectedObject, mouse);
			} else {
				movingObject = true;
				deltaMouseX = deltaMouseY = 0;
				if(selectedObject.setMouseStart) {
					selectedObject.setMouseStart(mouse.x, mouse.y);
				}
			}
			resetCaret();
		} else if(shift) {
			currentLink = new TemporaryLink(mouse, mouse);
		}

		draw();

		if(canvasHasFocus()) {
			// disable drag-and-drop only if the canvas is already focused
			return false;
		} else {
			// otherwise, let the browser switch the focus away from wherever it was
			resetCaret();
			return true;
		}
	};

	canvas.ondblclick = function(e) {
		var mouse = crossBrowserRelativeMousePos(e);
		selectedObject = selectObject(mouse.x, mouse.y);

		if(selectedObject == null) {
			selectedObject = new Node(mouse.x, mouse.y);
			nodes.push(selectedObject);
			resetCaret();
			draw();
		} else if(selectedObject instanceof Node) {
			selectedObject.isAcceptState = !selectedObject.isAcceptState;
			draw();
		}
	};

	canvas.onmousemove = function(e) {
		var mouse = crossBrowserRelativeMousePos(e);

		if(currentLink != null) {
			var targetNode = selectObject(mouse.x, mouse.y);
			if(!(targetNode instanceof Node)) {
				targetNode = null;
			}

			if(selectedObject == null) {
				if(targetNode != null) {
					currentLink = new StartLink(targetNode, originalClick);
				} else {
					currentLink = new TemporaryLink(originalClick, mouse);
				}
			} else {
				if(targetNode == selectedObject) {
					currentLink = new SelfLink(selectedObject, mouse);
				} else if(targetNode != null) {
					currentLink = new Link(selectedObject, targetNode);
				} else {
					currentLink = new TemporaryLink(selectedObject.closestPointOnCircle(mouse.x, mouse.y), mouse);
				}
			}
			draw();
		}

		if(movingObject) {
			selectedObject.setAnchorPoint(mouse.x, mouse.y);
			if(selectedObject instanceof Node) {
				snapNode(selectedObject);
			}
			draw();
		}
	};

	canvas.onmouseup = function(e) {
		movingObject = false;

		if(currentLink != null) {
			if(!(currentLink instanceof TemporaryLink)) {
				selectedObject = currentLink;
				links.push(currentLink);
				resetCaret();
			}
			currentLink = null;
			draw();
		}
	};
}

var shift = false;

function deleteSelectedObject() {
	if(selectedObject == null) return;
	for(var i = 0; i < nodes.length; i++) {
		if(nodes[i] == selectedObject) nodes.splice(i--, 1);
	}
	for(var i = 0; i < links.length; i++) {
		if(links[i] == selectedObject || links[i].node == selectedObject || links[i].nodeA == selectedObject || links[i].nodeB == selectedObject) {
			links.splice(i--, 1);
		}
	}
	selectedObject = null;
	draw();
}

document.onkeydown = function(e) {
	var key = crossBrowserKey(e);

	if(key == 16) {
		shift = true;
	} else if(!canvasHasFocus()) {
		// don't read keystrokes when other things have focus
		return true;
	} else if(key == 76 && ((e.ctrlKey || e.metaKey) && !e.altKey || e.altKey && !e.ctrlKey && !e.metaKey) && selectedObject != null && !(selectedObject instanceof Node)) {
  if(!e.repeat) {
   selectedObject.textBelow = !selectedObject.textBelow;
   draw();
  }
  return false;
 } else if((key >= 37 && key <= 40 || key == 36 || key == 35) && selectedObject != null && 'text' in selectedObject) {
  moveLabelCaret(key, e.ctrlKey || e.metaKey);
  resetCaret();
  draw();
  return false;
 } else if(key == 13 && selectedObject != null && 'text' in selectedObject && !(selectedObject instanceof Node)) {
  insertLabelText('\n');
  resetCaret();
  draw();
  return false;
 } else if(key == 8) { // backspace key
		if(selectedObject != null && 'text' in selectedObject) {
			if(selectedObject.text.length == 0) {
				// Require a fresh press after clearing text, rather than key repeat.
				if(!e.repeat) deleteSelectedObject();
			} else {
				eraseBeforeCaret();
				resetCaret();
				draw();
			}
		}

		// backspace is a shortcut for the back button, but do NOT want to change pages
		return false;
	} else if(key == 46) { // delete key
		deleteSelectedObject();
	}
};

document.onkeyup = function(e) {
	var key = crossBrowserKey(e);

	if(key == 16) {
		shift = false;
	}
};

document.onkeypress = function(e) {
	// don't read keystrokes when other things have focus
	var key = crossBrowserKey(e);
	if(!canvasHasFocus()) {
		// don't read keystrokes when other things have focus
		return true;
	} else if(key >= 0x20 && !e.metaKey && !e.altKey && !e.ctrlKey && selectedObject != null && 'text' in selectedObject) {
		insertLabelText(e.key && Array.from(e.key).length === 1 ? e.key : String.fromCharCode(key));
		resetCaret();
		draw();

		// don't let keys do their actions (like space scrolls down the page)
		return false;
	} else if(key == 8) {
		// backspace is a shortcut for the back button, but do NOT want to change pages
		return false;
	}
};

function crossBrowserKey(e) {
	e = e || window.event;
	return e.which || e.keyCode;
}

function crossBrowserElementPos(e) {
	e = e || window.event;
	var obj = e.target || e.srcElement;
	var x = 0, y = 0;
	while(obj.offsetParent) {
		x += obj.offsetLeft;
		y += obj.offsetTop;
		obj = obj.offsetParent;
	}
	return { 'x': x, 'y': y };
}

function crossBrowserMousePos(e) {
	e = e || window.event;
	return {
		'x': e.pageX || e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft,
		'y': e.pageY || e.clientY + document.body.scrollTop + document.documentElement.scrollTop,
	};
}

function crossBrowserRelativeMousePos(e) {
 var rect = canvas.getBoundingClientRect();
 return {x: (e.clientX - rect.left) * canvas.width / rect.width,
         y: (e.clientY - rect.top) * canvas.height / rect.height};
}

function output(text) {
	var element = document.getElementById('output');
	element.style.display = 'block';
	element.value = text;
}

function getExportFilename(extension) {
	var label = document.querySelector('.canvas-row.active .canvas-open');
	var name = window.getActiveCanvasName ? window.getActiveCanvasName() : (label ? label.textContent : 'Lienzo');
	name = name.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/\s+/g, '_').replace(/_+/g, '_').replace(/^[._]+|[._]+$/g, '').slice(0, 120) || 'Lienzo';
	return (/^Diagrama_/i.test(name) ? name : 'Diagrama_' + name) + '.' + extension;
}

function downloadExport(text, mime, extension, filename) {
	var url = URL.createObjectURL(new Blob([text], {type: mime}));
	var download = document.createElement('a');
	download.href = url;
	download.download = filename || getExportFilename(extension);
	download.click();
	setTimeout(function() { URL.revokeObjectURL(url); }, 10000);
}

function saveAsPNG() {
	var filename = getExportFilename('png');
	var drawing = document.createElement('canvas');
	drawing.width = canvas.width;
	drawing.height = canvas.height;
	var drawingContext = drawing.getContext('2d');
	var oldSelectedObject = selectedObject;
	var oldCurrentLink = currentLink;
	try {
		selectedObject = null;
		currentLink = null;
		drawUsing(drawingContext);
	} finally {
		selectedObject = oldSelectedObject;
		currentLink = oldCurrentLink;
	}
	// Match the dark on-screen drawing. CSS filters/backgrounds are not part of toDataURL.
	// The unselected diagram is grayscale, so inversion also matches its hue-rotated view.
	var pixels = drawingContext.getImageData(0, 0, drawing.width, drawing.height);
	for(var i = 0; i < pixels.data.length; i += 4) {
		pixels.data[i] = 255 - pixels.data[i];
		pixels.data[i + 1] = 255 - pixels.data[i + 1];
		pixels.data[i + 2] = 255 - pixels.data[i + 2];
	}
	drawingContext.putImageData(pixels, 0, 0);
	var screenshot = document.createElement('canvas');
	screenshot.width = canvas.width;
	screenshot.height = canvas.height;
	var context = screenshot.getContext('2d');
	context.fillStyle = '#000000';
	context.fillRect(0, 0, screenshot.width, screenshot.height);
	context.fillStyle = '#212121';
	for(var x = 0; x < screenshot.width; x += 24) context.fillRect(x, 0, 1, screenshot.height);
	for(var y = 0; y < screenshot.height; y += 24) context.fillRect(0, y, screenshot.width, 1);
	context.drawImage(drawing, 0, 0);
	screenshot.toBlob(function(blob) {
		if(!blob) { alert('No se pudo generar el PNG. Inténtalo de nuevo.'); return; }
		var url = URL.createObjectURL(blob);
		var download = document.createElement('a');
		download.href = url;
		download.download = filename;
		document.body.appendChild(download);
		download.click();
		download.remove();
		setTimeout(function() { URL.revokeObjectURL(url); }, 10000);
	}, 'image/png');
}

function saveAsSVG() {
	var exporter = new ExportAsSVG();
	var oldSelectedObject = selectedObject;
	selectedObject = null;
	drawUsing(exporter);
	selectedObject = oldSelectedObject;
	var svgData = exporter.toSVG();
	output(svgData);
	downloadExport(svgData, 'image/svg+xml;charset=utf-8', 'svg');
}

function saveAsLaTeX() {
	var exporter = new ExportAsLaTeX();
	var oldSelectedObject = selectedObject;
	selectedObject = null;
	drawUsing(exporter);
	selectedObject = oldSelectedObject;
	var texData = exporter.toLaTeX();
	output(texData);
	downloadExport(texData, 'application/x-tex;charset=utf-8', 'tex');
}

window.addEventListener('blur', function() { shift = false; movingObject = false; currentLink = null; });
