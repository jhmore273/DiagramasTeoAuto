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
 var originals = normalizeGreekShortcuts(originalText).split('\n');
 var lines = originals.map(convertLatexShortcuts);
 var lineHeight = 24;
 c.font = '20px "Bahnschrift", "Segoe UI", sans-serif';
 var widths = lines.map(function(line) { return c.measureText(line).width; });
 var width = Math.max.apply(Math, widths);
 var halfHeight = 10 + (lines.length - 1) * lineHeight / 2;
 // Keep every transition paragraph above its arrow anchor.
 if(angleOrNull != null) {
  y += (textBelow ? 1 : -1) * (halfHeight + 8);
 }
 for(var i = 0; i < lines.length; i++) {
  var lineY = y + (i - (lines.length - 1) / 2) * lineHeight;
  if('advancedFillText' in c) {
   c.advancedFillText(lines[i], originals[i], x, lineY, null);
  } else {
   var lineX = Math.round(x - widths[i] / 2);
   lineY = Math.round(lineY);
   c.fillText(lines[i], lineX, lineY + 6);
   if(i === lines.length - 1 && isSelected && caretVisible && canvasHasFocus() && document.hasFocus()) {
    var caretX = lineX + widths[i];
    c.beginPath();c.moveTo(caretX, lineY - 10);c.lineTo(caretX, lineY + 10);c.stroke();
   }
  }
 }
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
 } else if(key == 13 && selectedObject != null && 'text' in selectedObject && !(selectedObject instanceof Node)) {
  selectedObject.text += '\n';
  resetCaret();
  draw();
  return false;
 } else if(key == 8) { // backspace key
		if(selectedObject != null && 'text' in selectedObject) {
			if(selectedObject.text.length == 0) {
				// Require a fresh press after clearing text, rather than key repeat.
				if(!e.repeat) deleteSelectedObject();
			} else {
				selectedObject.text = selectedObject.text.substr(0, selectedObject.text.length - 1);
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
	} else if(key >= 0x20 && key <= 0x7E && !e.metaKey && !e.altKey && !e.ctrlKey && selectedObject != null && 'text' in selectedObject) {
		selectedObject.text += String.fromCharCode(key);
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
	var name = label ? label.textContent : 'Lienzo';
	name = name.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/\s+/g, '_').replace(/_+/g, '_').replace(/^[._]+|[._]+$/g, '').slice(0, 120) || 'Lienzo';
	return (/^Diagrama_/i.test(name) ? name : 'Diagrama_' + name) + '.' + extension;
}

function downloadExport(text, mime, extension) {
	var url = URL.createObjectURL(new Blob([text], {type: mime}));
	var download = document.createElement('a');
	download.href = url;
	download.download = getExportFilename(extension);
	download.click();
	setTimeout(function() { URL.revokeObjectURL(url); }, 10000);
}

function saveAsPNG() {
	var oldSelectedObject = selectedObject;
	selectedObject = null;
	drawUsing(canvas.getContext('2d'));
	selectedObject = oldSelectedObject;
	var pngData = canvas.toDataURL('image/png');
	var download = document.createElement('a');
	download.href = pngData;
	download.download = getExportFilename('png');
	download.click();
	draw();
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
