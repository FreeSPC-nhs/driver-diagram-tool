// driver.js
// Core logic for the Driver Diagram Tool

var nodes = [];
var nextId = 1;
var connections = [];
var legendVisible = true;
var columnTitles = {
  aim: "Aim",
  primary: "Primary drivers",
  secondary: "Secondary drivers",
  change: "Change ideas"
};
var editingColorValue = null; // e.g. "#ffc281"



// Diagram appearance settings (defaults)
var diagramAppearance = {
  boxHeight: 32,      // px
  verticalGap: 8,     // px between boxes
  fontSize: 13,       // px
  fontFamily: "",      // empty = inherit from page
  fontBold: false
};


// Colour options: { label, value } where value is a hex colour (e.g. "#ffcc00")
var colorOptions = [];

// View state
var controlsVisible = true;
var tableVisible = true;

// Level ordering for parent/child logic
var levelOrder = ["aim", "primary", "secondary", "change"];

function getPreviousLevel(level) {
  var idx = levelOrder.indexOf(level);
  if (idx > 0) return levelOrder[idx - 1];
  return null;
}

function getNextLevel(level) {
  var idx = levelOrder.indexOf(level);
  if (idx >= 0 && idx < levelOrder.length - 1) return levelOrder[idx + 1];
  return null;
}

function createNode(options) {
  options = options || {};
  var id = options.id;
  var level = options.level;
  var text = options.text;
  var parentId = options.parentId || "";
  var color = options.color || "";

  if (id === undefined || id === null || id === "") {
    id = String(nextId++);
  }

  return {
    id: id,
    level: level,
    text: text,
    parentId: parentId,
    color: color
  };
}

function updateNextIdFromNodes() {
  if (nodes.length === 0) {
    nextId = 1;
    return;
  }
  var maxId = 0;
  nodes.forEach(function (n) {
    var numeric = parseInt(n.id, 10);
    if (!isNaN(numeric) && numeric > maxId) {
      maxId = numeric;
    }
  });
  nextId = maxId + 1;
}

function rebuildConnectionsFromParents() {
  // Use each node's parentId to reconstruct the baseline tree
  connections = [];
  nodes.forEach(function (n) {
    if (n.parentId) {
      connections.push({ fromId: n.parentId, toId: n.id });
    }
  });
}


function getLevelLabel(level) {
  if (level === "aim") return "Aim";
  if (level === "primary") return "Primary";
  if (level === "secondary") return "Secondary driver";
  if (level === "change") return "Change idea";
  return level;
}

/* ---------- Colour helpers ---------- */

var editingColorValue = null; // value (hex) of the colour currently being edited

function refreshColorSelect() {
  var select = document.getElementById("nodeColor");
  if (!select) return;

  var currentValue = select.value;

  select.innerHTML = "";
  var noneOption = document.createElement("option");
  noneOption.value = "";
  noneOption.textContent = "No colour";
  select.appendChild(noneOption);

  colorOptions.forEach(function (opt) {
    var option = document.createElement("option");
    option.value = opt.value;
    option.textContent = opt.label + " (" + opt.value + ")";
    select.appendChild(option);
  });

  if (
    currentValue &&
    (currentValue === "" ||
      colorOptions.some(function (c) {
        return c.value === currentValue;
      }))
  ) {
    select.value = currentValue;
  }
}

function renderColorOptionsList() {
  var list = document.getElementById("colorOptionsList");
  if (!list) return;

  list.innerHTML = "";

  if (colorOptions.length === 0) {
    var li = document.createElement("li");
    li.textContent = "No custom colours defined yet.";
    list.appendChild(li);
    return;
  }

  colorOptions.forEach(function (opt, index) {
    var li = document.createElement("li");
    li.style.cursor = "pointer";
    li.title = "Click to edit this colour";

    li.textContent = (index + 1) + ". " + opt.label + " (" + opt.value + ")";

    // underline the one we're editing
    if (editingColorValue && opt.value.toLowerCase() === editingColorValue.toLowerCase()) {
      li.style.fontWeight = "600";
      li.style.textDecoration = "underline";
    }

    li.addEventListener("click", function () {
      var labelInput = document.getElementById("colorLabelInput");
      var valueInput = document.getElementById("colorValueInput");
      if (!labelInput || !valueInput) return;

      editingColorValue = opt.value;   // <-- THIS is the edit marker
      labelInput.value = opt.label;
      valueInput.value = opt.value;

      renderColorOptionsList();
    });

    list.appendChild(li);
  });
}

function addColorOptionFromForm() {
  var labelInput = document.getElementById("colorLabelInput");
  var valueInput = document.getElementById("colorValueInput");
  if (!labelInput || !valueInput) return;

  var label = (labelInput.value || "").trim();
  var value = (valueInput.value || "").trim();

  if (!value) {
    alert("Please choose a colour value.");
    return;
  }

  var isEditing = !!editingColorValue;

  // Only auto-name when adding (not when editing)
  if (!label) {
    if (!isEditing) {
      label = "Colour " + (colorOptions.length + 1);
    } else {
      // keep existing label if user erased it
      var existingLabel = colorOptions.find(function (c) {
        return c.value.toLowerCase() === editingColorValue.toLowerCase();
      });
      label = existingLabel ? existingLabel.label : "";
    }
  }

  if (isEditing) {
    var oldValue = editingColorValue;

    var target = colorOptions.find(function (c) {
      return c.value.toLowerCase() === oldValue.toLowerCase();
    });

    if (!target) {
      // fallback: if not found, add new
      colorOptions.push({ label: label, value: value });
    } else {
      target.label = label;
      target.value = value;

      // update nodes that used old colour value
      nodes.forEach(function (n) {
        if (n.color === oldValue) n.color = value;
      });
    }

    editingColorValue = null; // stop editing
  } else {
    // add new, or update by colour value if it already exists
    var existing = colorOptions.find(function (c) {
      return c.value.toLowerCase() === value.toLowerCase();
    });
    if (existing) {
      existing.label = label;
    } else {
      colorOptions.push({ label: label, value: value });
    }
  }

  labelInput.value = "";
  updateAllViews();
}

function rebuildColorOptionsFromNodes() {
  var seen = {};
  nodes.forEach(function (n) {
    if (n.color) seen[n.color] = true;
  });

  colorOptions = [];
  var index = 1;
  for (var value in seen) {
    if (!seen.hasOwnProperty(value)) continue;
    colorOptions.push({ label: "Colour " + index, value: value });
    index++;
  }

  editingColorValue = null;
  refreshColorSelect();
  renderColorOptionsList();
}

// Convert hex colour to { r, g, b }
function hexToRgb(hex) {
  if (!hex) return null;
  var h = hex.replace("#", "").trim();
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  if (h.length !== 6) return null;

  var r = parseInt(h.slice(0, 2), 16);
  var g = parseInt(h.slice(2, 4), 16);
  var b = parseInt(h.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return { r: r, g: g, b: b };
}

// Choose black or white text for best contrast
function getContrastingTextColor(hex) {
  var rgb = hexToRgb(hex);
  if (!rgb) return "#000000";

  // perceived brightness
  var brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return brightness > 130 ? "#000000" : "#ffffff";
}

function cycleNodeColor(node) {
  if (!colorOptions.length) {
    alert("No colour options defined yet. Add some colours on the left first.");
    return;
  }

  // Order: no colour (""), then each configured colour value
  var palette = [""].concat(
    colorOptions.map(function (c) {
      return c.value;
    })
  );

  var current = node.color || "";
  var currentIndex = palette.indexOf(current);
  if (currentIndex === -1) {
    currentIndex = 0;
  }

  var nextIndex = (currentIndex + 1) % palette.length;
  node.color = palette[nextIndex];

  updateAllViews();
}

/* ---------- Legend ---------- */

function renderLegend() {
  var list = document.getElementById("legendList");
  var emptyMsg = document.getElementById("legendEmptyMessage");
  if (!list || !emptyMsg) return;

  list.innerHTML = "";

  if (!colorOptions.length) {
    emptyMsg.style.display = "block";
    return;
  }

  emptyMsg.style.display = "none";

  colorOptions.forEach(function (opt) {
    var li = document.createElement("li");
    li.className = "legend-item";

    var swatch = document.createElement("span");
    swatch.className = "legend-color-swatch";
    swatch.style.backgroundColor = opt.value;

    var labelSpan = document.createElement("span");
    labelSpan.textContent = opt.label;

    li.appendChild(swatch);
    li.appendChild(labelSpan);
    list.appendChild(li);
  });
}

/* ---------- Diagram rendering (boxes + connecting lines) ---------- */

function renderDiagram() {
  var canvas = document.getElementById("diagramCanvas");
  var columnsContainer = document.getElementById("diagramColumns");
  var svg = document.getElementById("diagramConnections");
  if (!canvas || !columnsContainer || !svg) return;

  // Clear columns
  columnsContainer.innerHTML = "";

  var levels = levelOrder.slice();
  

  // Group nodes by level
  var byLevel = {};
  levels.forEach(function (level) {
    byLevel[level] = nodes.filter(function (n) {
      return n.level === level;
    });
  });

  // Build columns
  levels.forEach(function (level) {
    var col = document.createElement("div");
    col.className = "diagram-column";
    if (level === "aim") {
      col.classList.add("aim-column");
    }

    var title = document.createElement("div");
    title.className = "diagram-column-title";
    title.textContent = columnTitles[level] || "";
title.title = "Click to edit this heading";
title.style.cursor = "pointer";
title.tabIndex = 0;

title.addEventListener("click", function (e) {
  e.stopPropagation();
  var current = columnTitles[level] || "";
  var next = window.prompt("Edit heading:", current);
  if (next === null) return;
  columnTitles[level] = next.trim() || current;
  updateAllViews();
});

// optional: Enter key edits too
title.addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    e.preventDefault();
    title.click();
  }
});
    col.appendChild(title);

    var stack = document.createElement("div");
    stack.className = "diagram-column-stack";
    col.appendChild(stack);
    
    // Vertical distribution per column
    if (level === "aim" && byLevel[level].length === 1) {
      stack.style.justifyContent = "center";
    } else {
      stack.style.justifyContent = "space-evenly";
    }

    // Use verticalGap as padding at top/bottom of the stack
    if (diagramAppearance) {
      var pad = (diagramAppearance.verticalGap || 0) / 2;
      stack.style.paddingTop = pad + "px";
      stack.style.paddingBottom = pad + "px";
    }

    byLevel[level].forEach(function (node) {
      var box = document.createElement("div");
      box.className = "diagram-node level-" + level;
      box.setAttribute("data-id", node.id);

	// Apply appearance settings
    if (diagramAppearance) {
      box.style.minHeight = diagramAppearance.boxHeight + "px";
      box.style.fontSize = diagramAppearance.fontSize + "px";
      if (diagramAppearance.fontFamily) {
        box.style.fontFamily = diagramAppearance.fontFamily;
      } else {
        box.style.fontFamily = ""; // inherit
      }
      box.style.fontWeight = diagramAppearance.fontBold ? "700" : "400"; 
      box.style.marginTop = (diagramAppearance.verticalGap / 2) + "px";
      box.style.marginBottom = (diagramAppearance.verticalGap / 2) + "px";
    }

      // Apply colour fill if set
      if (node.color) {
        box.style.backgroundColor = node.color;
        box.style.borderColor = "#999";
        box.style.color = getContrastingTextColor(node.color);
      } else {
        box.style.backgroundColor = "#ffffff";
        box.style.borderColor = "#d0d7de";
        box.style.color = "#000000";
      }

      // Add buttons for parent/child
      var prevLevel = getPreviousLevel(level);
      var nextLevel = getNextLevel(level);

	if (prevLevel && level !== "primary") {
  var leftBtn = document.createElement("button");
  leftBtn.type = "button";
  leftBtn.className = "diagram-add diagram-add-left";

  // Size the connector to match box height
  if (diagramAppearance && diagramAppearance.boxHeight) {
    var h = diagramAppearance.boxHeight;
    leftBtn.style.height = h + "px";
    leftBtn.style.width = h + "px";
    leftBtn.style.borderRadius = (h / 2) + "px";
    leftBtn.style.left = -(h / 2) + "px";
  }

  // Match connector colour to node
  if (node.color) {
    leftBtn.style.backgroundColor = node.color;
    leftBtn.style.borderColor = node.color;
    leftBtn.style.color = getContrastingTextColor(node.color); // keep symbol readable
  } else {
    leftBtn.style.backgroundColor = "#ffffff";
    leftBtn.style.borderColor = "#d0d7de";
    leftBtn.style.color = "#555";
  }

  leftBtn.textContent = "📌";
  leftBtn.title =
    "Add or remove a connection to a " + getLevelLabel(prevLevel);
  leftBtn.setAttribute(
    "aria-label",
    "Add or remove connection to " + getLevelLabel(prevLevel)
  );

  leftBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    handleConnectionButtonClick(node.id); // 👈 use the new manager
  });

  box.appendChild(leftBtn);
}


      if (nextLevel) {
        var rightBtn = document.createElement("button");
        rightBtn.type = "button";
        rightBtn.className = "diagram-add diagram-add-right";
	// Size the connector to match box height
        if (diagramAppearance && diagramAppearance.boxHeight) {
          var h2 = diagramAppearance.boxHeight;
          rightBtn.style.height = h2 + "px";
          rightBtn.style.width = h2 + "px";
          rightBtn.style.borderRadius = (h2 / 2) + "px";
	  rightBtn.style.right = -(h2 / 2) + "px"; 
        }		
	// Match connector colour to node
	if (node.color) {
  	rightBtn.style.backgroundColor = node.color;
  	rightBtn.style.borderColor = node.color;
  	rightBtn.style.color = getContrastingTextColor(node.color);
	} else {
  	rightBtn.style.backgroundColor = "#ffffff";
  	rightBtn.style.borderColor = "#d0d7de";
  	rightBtn.style.color = "#555";
	}
        rightBtn.textContent = "+"; // child
        rightBtn.title = "Add " + getLevelLabel(nextLevel) + " (child)";
        rightBtn.setAttribute("aria-label", "Add child " + getLevelLabel(nextLevel));
        rightBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          addChildForNode(node.id);
        });
        box.appendChild(rightBtn);
      }


      // Text content
      var textSpan = document.createElement("span");
      textSpan.textContent = node.text;
      textSpan.title = "Click to edit text";
      textSpan.addEventListener("click", function (e) {
        e.stopPropagation();
        editNode(node.id);
      });
      box.appendChild(textSpan);

      // Colour badge
      var badge = document.createElement("div");
      badge.className = "diagram-color-badge";
      if (node.color) {
        badge.style.backgroundColor = node.color;
      } else {
        badge.style.backgroundColor = "#ffffff";
      }
      // Hint text / accessibility label
      badge.title = "Click to change the colour of this box";
      badge.setAttribute("aria-label", "Change colour");
      badge.addEventListener("click", function (e) {
        e.stopPropagation();
        cycleNodeColor(node);
      });
      box.appendChild(badge);

      stack.appendChild(box);
    });

    columnsContainer.appendChild(col);
  });

  // Draw connecting lines after layout has happened
  if (!window.requestAnimationFrame) {
    drawConnections(canvas, svg);
  } else {
    window.requestAnimationFrame(function () {
      drawConnections(canvas, svg);
    });
  }
}

function drawConnections(canvas, svg) {
  var canvasRect = canvas.getBoundingClientRect();

  // Clear previous lines
  while (svg.firstChild) {
    svg.removeChild(svg.firstChild);
  }

  var w = canvasRect.width;
  var h = canvasRect.height;

  svg.setAttribute("width", w);
  svg.setAttribute("height", h);
  // NEW: ensure the SVG coordinate system matches what we draw
  svg.setAttribute("viewBox", "0 0 " + w + " " + h);



  connections.forEach(function (conn) {
    var parentEl = canvas.querySelector(
      '.diagram-node[data-id="' + conn.fromId + '"]'
    );
    var childEl = canvas.querySelector(
      '.diagram-node[data-id="' + conn.toId + '"]'
    );
    if (!parentEl || !childEl) return;

    var parentRect = parentEl.getBoundingClientRect();
    var childRect = childEl.getBoundingClientRect();

    var x1 = parentRect.right - canvasRect.left;
    var y1 = parentRect.top + parentRect.height / 2 - canvasRect.top;
    var x2 = childRect.left - canvasRect.left;
    var y2 = childRect.top + childRect.height / 2 - canvasRect.top;

    var midX = (x1 + x2) / 2;

    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    var d =
      "M " +
      x1 +
      " " +
      y1 +
      " C " +
      midX +
      " " +
      y1 +
      ", " +
      midX +
      " " +
      y2 +
      ", " +
      x2 +
      " " +
      y2;

    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "#666");
    path.setAttribute("stroke-width", "2.5");
    path.setAttribute("stroke-linecap", "round");

    svg.appendChild(path);
  });

}

/* ---------- Form helpers & table ---------- */

function refreshParentOptions() {
  var parentSelect = document.getElementById("nodeParent");
  if (!parentSelect) return;

  var currentValue = parentSelect.value;

  parentSelect.innerHTML = "";
  var noneOption = document.createElement("option");
  noneOption.value = "";
  noneOption.textContent = "— None / top level —";
  parentSelect.appendChild(noneOption);

  nodes.forEach(function (node) {
    var opt = document.createElement("option");
    opt.value = node.id;
    var shortText =
      node.text.length > 50 ? node.text.slice(0, 47) + "…" : node.text;
    opt.textContent =
      "[" + node.id + "] " + getLevelLabel(node.level) + " – " + shortText;
    parentSelect.appendChild(opt);
  });

  if (
    currentValue &&
    nodes.some(function (n) {
      return n.id === currentValue;
    })
  ) {
    parentSelect.value = currentValue;
  }
}

function createColorSelectForNode(node) {
  var select = document.createElement("select");
  select.style.fontSize = "0.8rem";
  select.style.padding = "0.2rem 0.3rem";

  var noneOpt = document.createElement("option");
  noneOpt.value = "";
  noneOpt.textContent = "No colour";
  select.appendChild(noneOpt);

  colorOptions.forEach(function (opt) {
    var o = document.createElement("option");
    o.value = opt.value;
    o.textContent = opt.label;
    select.appendChild(o);
  });

  if (node.color) {
    var found = colorOptions.some(function (c) {
      return c.value === node.color;
    });
    if (!found) {
      var customOpt = document.createElement("option");
      customOpt.value = node.color;
      customOpt.textContent = "Custom (" + node.color + ")";
      select.appendChild(customOpt);
    }
  }

  select.value = node.color || "";

  select.addEventListener("change", function () {
    node.color = select.value;
    updateAllViews();
  });

  return select;
}

function renderNodesTable() {
  var tableWrapper = document.getElementById("nodesTableWrapper");
  var tbody = document.getElementById("nodesTableBody");
  var noItemsMessage = document.getElementById("noItemsMessage");

  if (!tableWrapper || !tbody || !noItemsMessage) return;

  tbody.innerHTML = "";

  if (nodes.length === 0) {
    tableWrapper.style.display = "none";
    noItemsMessage.style.display = "block";
    return;
  }

  // Only show table if tableVisible
  if (!tableVisible) {
    tableWrapper.style.display = "none";
  } else {
    tableWrapper.style.display = "block";
  }
  noItemsMessage.style.display = "none";

  nodes.forEach(function (node) {
    var tr = document.createElement("tr");

    var tdId = document.createElement("td");
    tdId.textContent = node.id;
    tr.appendChild(tdId);

    var tdLevel = document.createElement("td");
    tdLevel.textContent = getLevelLabel(node.level);
    tr.appendChild(tdLevel);

    // Colour column
    var tdColor = document.createElement("td");
    tdColor.appendChild(createColorSelectForNode(node));
    tr.appendChild(tdColor);

    var tdParent = document.createElement("td");
    if (node.parentId) {
      var parent = nodes.find(function (n) {
        return n.id === node.parentId;
      });
      tdParent.textContent = parent
        ? "[" + parent.id + "] " + getLevelLabel(parent.level)
        : "(Missing: " + node.parentId + ")";
    } else {
      tdParent.textContent = "—";
    }
    tr.appendChild(tdParent);

    var tdText = document.createElement("td");
    tdText.textContent = node.text;
    tr.appendChild(tdText);

    var tdActions = document.createElement("td");
    var delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.className = "danger";
    delBtn.style.padding = "0.25rem 0.5rem";
    delBtn.style.fontSize = "0.8rem";
    delBtn.addEventListener("click", function () {
      deleteNode(node.id);
    });
    tdActions.appendChild(delBtn);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });
}

function setupCollapsibleSections() {
  var panel = document.getElementById("controlsPanel");
  if (!panel) return;

  // prevent double-binding if called more than once
  if (panel._collapsibleBound) return;
  panel._collapsibleBound = true;

  panel.addEventListener("click", function (e) {
    var el = e.target;

    // Walk up the DOM until we hit a collapsible header or the panel
    while (el && el !== panel) {
      if (el.classList && el.classList.contains("collapsible-header")) break;
      el = el.parentNode;
    }
    if (!el || el === panel) return;

    var targetId = el.getAttribute("data-target");
    if (!targetId) return;

    var section = document.getElementById(targetId);
    if (!section) return;

    var indicator = el.querySelector(".collapsible-indicator");
    var collapsed = section.classList.toggle("is-collapsed");
    if (indicator) indicator.textContent = collapsed ? "▸" : "▾";
  });
}


function applyDiagramAppearanceFromInputs() {
  var hInput = document.getElementById("boxHeightInput");
  var gInput = document.getElementById("boxGapInput");
  var fsInput = document.getElementById("boxFontSizeInput");
  var ffInput = document.getElementById("boxFontFamilyInput");
  var boldInput = document.getElementById("boxFontBoldInput");

  if (!hInput || !gInput || !fsInput || !ffInput) return;

  var h = parseInt(hInput.value, 10);
  var g = parseInt(gInput.value, 10);
  var fs = parseInt(fsInput.value, 10);
  var ff = ffInput.value.trim();
  var bold = !!(boldInput && boldInput.checked);

  if (!isFinite(h) || h <= 0) h = 32;
  if (!isFinite(g) || g < 0) g = 8;
  if (!isFinite(fs) || fs <= 0) fs = 13;

  diagramAppearance.boxHeight = h;
  diagramAppearance.verticalGap = g;
  diagramAppearance.fontSize = fs;
  diagramAppearance.fontFamily = ff;
  diagramAppearance.fontBold = bold; 

  updateAllViews();
}

function setAppearanceInputsFromConfig() {
  var hInput = document.getElementById("boxHeightInput");
  var gInput = document.getElementById("boxGapInput");
  var fsInput = document.getElementById("boxFontSizeInput");
  var ffInput = document.getElementById("boxFontFamilyInput");
  var boldInput = document.getElementById("boxFontBoldInput");

  if (!hInput || !gInput || !fsInput || !ffInput || !boldInput) return;

  hInput.value = diagramAppearance.boxHeight;
  gInput.value = diagramAppearance.verticalGap;
  fsInput.value = diagramAppearance.fontSize;
  ffInput.value = diagramAppearance.fontFamily || "";
  boldInput.checked = !!diagramAppearance.fontBold;
}


function updateAllViews() {
  renderNodesTable();
  refreshParentOptions();
  renderDiagram();
  refreshColorSelect();
  renderColorOptionsList();
  renderLegend();
  updateLegendVisibility();
}

/* ---------- Actions from the form ---------- */

function addNodeFromForm() {
  var textEl = document.getElementById("nodeText");
  var levelEl = document.getElementById("nodeLevel");
  var parentEl = document.getElementById("nodeParent");
  var colorEl = document.getElementById("nodeColor");

  if (!textEl || !levelEl || !parentEl) return;

  var text = textEl.value.trim();
  var level = levelEl.value;
  var parentId = parentEl.value;
  var color = colorEl ? colorEl.value : "";

  if (!text) {
    alert("Please enter some text for this item.");
    return;
  }

    var node = createNode({
    level: level,
    text: text,
    parentId: parentId,
    color: color
  });
  nodes.push(node);

  // If a parent was chosen, add a connection for it
  if (parentId) {
    connections.push({ fromId: parentId, toId: node.id });
  }

  textEl.value = "";
  updateAllViews();

}

/* ---------- Edit existing node ---------- */

function editNode(nodeId) {
  var node = nodes.find(function (n) {
    return n.id === nodeId;
  });
  if (!node) return;

  var newText = window.prompt("Edit text for this item:", node.text);
  if (newText === null) {
    // user pressed Cancel
    return;
  }
  newText = newText.trim();
  if (!newText) {
    alert("Text cannot be empty.");
    return;
  }

  node.text = newText;
  updateAllViews();
}

/* ---------- Actions from + buttons ---------- */

function addConnectionForNode(nodeId) {
  var refNode = nodes.find(function (n) {
    return n.id === nodeId;
  });
  if (!refNode) return;

  var prevLevel = getPreviousLevel(refNode.level);
  if (!prevLevel) {
    alert("This item is already at the highest level and cannot have a parent.");
    return;
  }

  // Candidates: nodes on the previous level
  var candidates = nodes.filter(function (n) {
    return n.level === prevLevel && n.id !== nodeId;
  });

  if (!candidates.length) {
    alert("No " + getLevelLabel(prevLevel) + " items available to connect to yet.");
    return;
  }

  var listText = candidates
    .map(function (n) {
      var shortText =
        n.text.length > 40 ? n.text.slice(0, 37) + "…" : n.text;
      return "[" + n.id + "] " + shortText;
    })
    .join("\n");

  var defaultId = refNode.parentId || candidates[0].id;
  var input = window.prompt(
    "Enter the ID of the " +
      getLevelLabel(prevLevel) +
      " you want to connect to this item:\n\n" +
      listText,
    defaultId
  );
  if (input === null) return;
  var parentId = input.trim();
  if (!parentId) {
    alert("No ID entered.");
    return;
  }

  var parent = candidates.find(function (n) {
    return n.id === parentId;
  });
  if (!parent) {
    alert("No item found with ID " + parentId + ".");
    return;
  }

  // Prevent duplicate link
  var exists = connections.some(function (c) {
    return c.fromId === parentId && c.toId === nodeId;
  });
  if (exists) {
    alert("That connection already exists.");
    return;
  }

  connections.push({ fromId: parentId, toId: nodeId });

  // If this item does not yet have a primary parent, use this one
  if (!refNode.parentId) {
    refNode.parentId = parentId;
  }

  updateAllViews();
}

function removeConnectionForNode(nodeId) {
  var refNode = nodes.find(function (n) {
    return n.id === nodeId;
  });
  if (!refNode) return;

  // All parents that currently have a line to this node
  var parentIds = connections
    .filter(function (c) {
      return c.toId === nodeId;
    })
    .map(function (c) {
      return c.fromId;
    });

  // Deduplicate
  parentIds = parentIds.filter(function (pid, idx, arr) {
    return arr.indexOf(pid) === idx;
  });

  if (!parentIds.length) {
    alert("This item has no incoming connections to remove.");
    return;
  }

  var listText = parentIds
    .map(function (pid) {
      var parent = nodes.find(function (n) {
        return n.id === pid;
      });
      var label = parent ? parent.text : "(missing item)";
      if (label.length > 40) {
        label = label.slice(0, 37) + "…";
      }
      return "[" + pid + "] " + label;
    })
    .join("\n");

  var input = window.prompt(
    "Enter the ID of the parent connection you want to remove:\n\n" +
      listText,
    parentIds[0]
  );
  if (input === null) return;
  var parentId = input.trim();
  if (!parentId || parentIds.indexOf(parentId) === -1) {
    alert("No connection found for ID " + parentId + ".");
    return;
  }

  // Remove that specific connection
  connections = connections.filter(function (c) {
    return !(c.fromId === parentId && c.toId === nodeId);
  });

  // If this was the 'main' parent, update parentId to another parent (if any)
  if (refNode.parentId === parentId) {
    var remainingParents = connections
      .filter(function (c) {
        return c.toId === nodeId;
      })
      .map(function (c) {
        return c.fromId;
      });

    refNode.parentId = remainingParents.length ? remainingParents[0] : "";
  }

  updateAllViews();
}

function handleConnectionButtonClick(nodeId) {
  // Does this node currently have any incoming connections?
  var hasParents = connections.some(function (c) {
    return c.toId === nodeId;
  });

  // If there are no parents, just add a new connection as before
  if (!hasParents) {
    addConnectionForNode(nodeId);
    return;
  }

  var choice = window.prompt(
    "What would you like to do?\n\n" +
      "1 = Add a new connection\n" +
      "2 = Remove an existing connection",
    "1"
  );
  if (choice === null) return;
  choice = choice.trim();

  if (choice === "1") {
    addConnectionForNode(nodeId);
  } else if (choice === "2") {
    removeConnectionForNode(nodeId);
  }
}


function addChildForNode(nodeId) {
  var refNode = nodes.find(function (n) {
    return n.id === nodeId;
  });
  if (!refNode) return;

  var nextLevel = getNextLevel(refNode.level);
  if (!nextLevel) {
    // No further level; keep same level for extra children
    nextLevel = refNode.level;
  }

  var defaultPrompt =
    "Enter text for new " + getLevelLabel(nextLevel) + " (child)";
  var text = window.prompt(defaultPrompt, "");
  if (!text) return;

  var newNode = createNode({
    level: nextLevel,
    text: text.trim(),
    parentId: refNode.id,
    color: refNode.color // inherit colour
  });

    nodes.push(newNode);

  // Record the connection parent -> child
  connections.push({ fromId: refNode.id, toId: newNode.id });

  updateAllViews();

}

function ensureDefaultAim() {
  var hasAim = nodes.some(function (n) {
    return n.level === "aim";
  });
  if (hasAim) return;

  var aimNode = createNode({
    level: "aim",
    text: "Aim",     // you can change to "Click to edit…" if you prefer
    parentId: "",
    color: ""
  });

  nodes.push(aimNode);
  updateNextIdFromNodes();
}



/* ---------- Clear / delete ---------- */

function clearAllNodes() {
  if (!window.confirm("Clear all items from this driver diagram?")) return;
  nodes = [];
  connections = [];
  updateNextIdFromNodes();
  ensureDefaultAim();
  updateAllViews();
}

function deleteNode(id) {
  var toDelete = new Set([id]);
  var changed = true;

  while (changed) {
    changed = false;
    nodes.forEach(function (n) {
      if (n.parentId && toDelete.has(n.parentId) && !toDelete.has(n.id)) {
        toDelete.add(n.id);
        changed = true;
      }
    });
  }

  if (
    !window.confirm(
      "Delete this item and " + (toDelete.size - 1) + " dependent item(s)?"
    )
  ) {
    return;
  }

    nodes = nodes.filter(function (n) {
    return !toDelete.has(n.id);
  });

  // Remove any connections touching deleted nodes
  connections = connections.filter(function (c) {
    return !toDelete.has(c.fromId) && !toDelete.has(c.toId);
  });

  updateNextIdFromNodes();
  ensureDefaultAim();
  updateAllViews();

}

/* ---------- CSV import / export ---------- */

function downloadCsv() {
  if (nodes.length === 0) {
    alert("No items to export yet.");
    return;
  }

    var dataForCsv = nodes.map(function (n) {
    // all parents for this node according to connections
    var parentLinks = connections
      .filter(function (c) { return c.toId === n.id; })
      .map(function (c) { return c.fromId; });

    // main parent stays in parent_id column
    var mainParentId = n.parentId || "";

    // extra parents are any other connected parents
    var extraParents = parentLinks.filter(function (pid) {
      return pid && pid !== mainParentId;
    });

    return {
      id: n.id,
      level: n.level,
      parent_id: mainParentId,
      text: n.text,
      color: n.color || "",
      extra_parents: extraParents.join(";"),
      box_height: diagramAppearance.boxHeight,
      vertical_gap: diagramAppearance.verticalGap,
      font_size: diagramAppearance.fontSize,
      font_family: diagramAppearance.fontFamily || "",
      font_bold: diagramAppearance.fontBold ? "1" : "0",
	title_aim: columnTitles.aim,
	title_primary: columnTitles.primary,
	title_secondary: columnTitles.secondary,
	title_change: columnTitles.change,
	palette_json: JSON.stringify(colorOptions || [])

    };
  });


  var csv = Papa.unparse(dataForCsv);
  var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  var url = URL.createObjectURL(blob);

  var link = document.createElement("a");
  link.href = url;
  link.download = "driver-diagram.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function uploadCsv(file) {
  if (!file) return;

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: function (results) {
      if (results.errors && results.errors.length > 0) {
        console.error("CSV parse errors", results.errors);
      }

      var rows = results.data;
      var imported = [];
      var extraConnectionsRaw = []; // { childId, parents[] }
      var appearanceFromCsv = null;
	var titlesFromCsv = null;
	var paletteFromCsv = null;


      rows.forEach(function (row, index) {
        var id = (row.id || "").toString().trim();
        var level = (row.level || "").toString().trim();
        var text = (row.text || "").toString().trim();
        var parentId = (row.parent_id || "").toString().trim();
        var color = (row.color || "").toString().trim();

        // new column (may be missing in older CSVs)
        var extraParentsField =
          (row.extra_parents || "").toString().trim();

        if (!id || !level || !text) {
          console.warn(
            "Skipping row " + (index + 1) + " - missing id/level/text."
          );
          return;
        }

        imported.push({
          id: id,
          level: level,
          text: text,
          parentId: parentId,
          color: color
        });

        // Parse extra parents into an array of IDs
        if (extraParentsField) {
          var parents = extraParentsField
            .split(/[;,]/)
            .map(function (s) { return s.trim(); })
            .filter(Boolean);

          if (parents.length) {
            extraConnectionsRaw.push({ childId: id, parents: parents });
          }
        }

	if (!paletteFromCsv) {
	  var rawPalette = (row.palette_json || "").toString().trim();
	  if (rawPalette) {
	    try {
	      var parsed = JSON.parse(rawPalette);
	      if (Array.isArray(parsed)) paletteFromCsv = parsed;
	    } catch (e) {
	      console.warn("Could not parse palette_json:", e);
	    }
	  }
	}


	if (!titlesFromCsv) {
  	var ta = (row.title_aim || "").toString().trim();
  	var tp = (row.title_primary || "").toString().trim();
  	var ts = (row.title_secondary || "").toString().trim();
  	var tc = (row.title_change || "").toString().trim();

  	var hasAnyTitle = ta || tp || ts || tc;
  	if (hasAnyTitle) {
  	  titlesFromCsv = { aim: ta, primary: tp, secondary: ts, change: tc };
 	 }
	}


        // --- NEW: appearance settings (read once, from first row that has them) ---
        if (!appearanceFromCsv) {
          var bh = parseInt(row.box_height, 10);
          var vg = parseInt(row.vertical_gap, 10);
          var fs = parseInt(row.font_size, 10);
          var ff = (row.font_family || "").toString();
          var fbRaw = (row.font_bold || "").toString().trim().toLowerCase();
          var fb = fbRaw === "1" || fbRaw === "true" || fbRaw === "yes";

          var hasAny =
            (row.box_height && !isNaN(bh)) ||
            (row.vertical_gap && !isNaN(vg)) ||
            (row.font_size && !isNaN(fs)) ||
            ff ||
            fbRaw;

          if (hasAny) {
            appearanceFromCsv = {
              boxHeight: isFinite(bh) && bh > 0 ? bh : diagramAppearance.boxHeight,
              verticalGap: isFinite(vg) && vg >= 0 ? vg : diagramAppearance.verticalGap,
              fontSize: isFinite(fs) && fs > 0 ? fs : diagramAppearance.fontSize,
              fontFamily: ff,
              fontBold: fb
            };
          }
        }
      });

      nodes = imported;
      updateNextIdFromNodes();
      if (paletteFromCsv && paletteFromCsv.length) {
	  // Use saved palette (keeps colour names)
	  colorOptions = paletteFromCsv
	    .map(function (o) {
	      return {
	        label: (o.label || "").toString().trim(),
	        value: (o.value || "").toString().trim()
	      };
	    })
	    .filter(function (o) {
	      return o.label && o.value;
	    });
	
	  
	} else {
	  // Fallback for older CSVs
	  rebuildColorOptionsFromNodes();
	}


      // First, rebuild baseline connections from primary parent_id
      rebuildConnectionsFromParents();

      // Then add extra connections from extra_parents
      extraConnectionsRaw.forEach(function (entry) {
        var childId = entry.childId;
        entry.parents.forEach(function (pid) {
          // only add if both ends exist and it's not already present
          var parentExists = nodes.some(function (n) { return n.id === pid; });
          var childExists = nodes.some(function (n) { return n.id === childId; });
          if (!parentExists || !childExists) return;

          var already = connections.some(function (c) {
            return c.fromId === pid && c.toId === childId;
          });
          if (!already) {
            connections.push({ fromId: pid, toId: childId });
          }
        });
      });

      // Apply appearance settings from CSV (if present)
      if (appearanceFromCsv) {
        diagramAppearance.boxHeight = appearanceFromCsv.boxHeight;
        diagramAppearance.verticalGap = appearanceFromCsv.verticalGap;
        diagramAppearance.fontSize = appearanceFromCsv.fontSize;
        diagramAppearance.fontFamily = appearanceFromCsv.fontFamily;
        diagramAppearance.fontBold = appearanceFromCsv.fontBold;
        setAppearanceInputsFromConfig();
      }

	if (titlesFromCsv) {
	  if (titlesFromCsv.aim) columnTitles.aim = titlesFromCsv.aim;
	  if (titlesFromCsv.primary) columnTitles.primary = titlesFromCsv.primary;
	  if (titlesFromCsv.secondary) columnTitles.secondary = titlesFromCsv.secondary;
	  if (titlesFromCsv.change) columnTitles.change = titlesFromCsv.change;
	}

	renderColorOptionsList();
	renderLegend();


      updateAllViews();
      alert("Loaded " + nodes.length + " items from CSV.");
    }
  });
}

/* ---------- View toggles & export ---------- */

function toggleControlsVisibility() {
  var panel = document.getElementById("controlsPanel");
  var btn = document.getElementById("btnToggleControls");
  var layout = document.querySelector("main"); // the 2-column grid
  if (!panel || !btn || !layout) return;

  controlsVisible = !controlsVisible;
  panel.style.display = controlsVisible ? "" : "none";
  btn.textContent = controlsVisible ? "Hide controls" : "Show controls";

  // When controls are hidden, make the diagram take full width;
  // when shown, revert to the original 2-column layout.
  if (controlsVisible) {
    layout.style.gridTemplateColumns = ""; // fall back to CSS (two columns)
  } else {
    layout.style.gridTemplateColumns = "minmax(0, 1fr)"; // single column
  }

  // Recalculate node positions and redraw connection lines after layout change
  if (window.requestAnimationFrame) {
    window.requestAnimationFrame(updateAllViews);
  } else {
    updateAllViews();
  }
}

function toggleTableVisibility() {
  var btn = document.getElementById("btnToggleTable");
  if (!btn) return;

  tableVisible = !tableVisible;
  btn.textContent = tableVisible ? "Hide table" : "Show table";
  updateAllViews();
}

// Helper: temporarily replace the live SVG with an <img> snapshot
// so html2canvas / html2pdf capture lines reliably.

function withSvgImageOverlay(runCapture) {
  var exportArea = document.getElementById("exportArea");
  var svg = document.getElementById("diagramConnections");
  var canvasDiv = document.getElementById("diagramCanvas");
  if (!exportArea || !svg || !canvasDiv) {
    // Fallback: run capture directly
    return runCapture();
  }

  // Make sure positions + connections are up to date
  updateAllViews();

  var serializer;
  try {
    serializer = new XMLSerializer();
  } catch (e) {
    console.error("XMLSerializer not available, capturing directly.", e);
    return runCapture();
  }

  var svgClone = svg.cloneNode(true);
  var svgString = serializer.serializeToString(svgClone);
  var dataUrl =
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(svgString);

  return new Promise(function (resolve, reject) {
    var img = new Image();
    img.onload = function () {
      // Hide original SVG and overlay the image in the same spot
      svg.style.visibility = "hidden";
      img.style.position = "absolute";
      img.style.top = "0";
      img.style.left = "0";
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.pointerEvents = "none";

      canvasDiv.appendChild(img);

      var p;
      try {
        p = runCapture();
      } catch (err) {
        cleanup();
        reject(err);
        return;
      }

      function cleanup() {
        try {
          canvasDiv.removeChild(img);
        } catch (e) {}
        svg.style.visibility = "";
      }

      if (p && typeof p.then === "function") {
        p.then(function (result) {
          cleanup();
          resolve(result);
        }).catch(function (err) {
          cleanup();
          reject(err);
        });
      } else {
        cleanup();
        resolve(p);
      }
    };

    img.onerror = function (err) {
      console.error("SVG image overlay failed, capturing directly.", err);
      // Fallback: run capture without overlay
      try {
        var p2 = runCapture();
        if (p2 && typeof p2.then === "function") {
          p2.then(resolve).catch(reject);
        } else {
          resolve(p2);
        }
      } catch (e2) {
        reject(e2);
      }
    };

    img.src = dataUrl;
  });
}



function exportDiagramPng() {
  var exportArea = document.getElementById("exportArea");
  if (!exportArea) {
    alert("Could not find diagram to export.");
    return;
  }

  // Hide badges + add/connect buttons for export
  exportArea.classList.add("export-clean");

  withSvgImageOverlay(function () {
    // Return the html2canvas promise so the helper can clean up afterwards
    return html2canvas(exportArea, {
      scale: 2,
      useCORS: true,
      logging: false
    });
  })
    .then(function (canvas) {
      exportArea.classList.remove("export-clean");
      if (!canvas) return;

      canvas.toBlob(function (blob) {
        if (!blob) return;
        var url = URL.createObjectURL(blob);
        var link = document.createElement("a");
        link.href = url;
        link.download = "driver-diagram.png";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      });
    })
    .catch(function (err) {
      console.error("PNG export error:", err);
      exportArea.classList.remove("export-clean");
    });
}



function exportDiagramPdf() {
  var exportArea = document.getElementById("exportArea");
  if (!exportArea) {
    alert("Could not find diagram to export.");
    return;
  }

  var opt = {
    margin: 10,
    filename: "driver-diagram.pdf",
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: "mm", format: "a4", orientation: "landscape" }
  };

  exportArea.classList.add("export-clean");

  withSvgImageOverlay(function () {
    // html2pdf returns a Promise
    return html2pdf().set(opt).from(exportArea).save();
  })
    .then(function () {
      exportArea.classList.remove("export-clean");
    })
    .catch(function (err) {
      console.error("PDF export error:", err);
      exportArea.classList.remove("export-clean");
    });
}



function updateLegendVisibility() {
    var legend = document.getElementById("legendContainer");
    var btn = document.getElementById("toggleLegendBtn");

    if (legendVisible) {
        legend.style.display = "block";
        btn.textContent = "Hide legend";
    } else {
        legend.style.display = "none";
        btn.textContent = "Show legend";
    }
}

/* ---------- Help / info modal ---------- */

function openHelpOverlay() {
  var overlay = document.getElementById("helpOverlay");
  if (!overlay) return;
  overlay.classList.add("is-open");
  overlay.setAttribute("aria-hidden", "false");
}

function closeHelpOverlay() {
  var overlay = document.getElementById("helpOverlay");
  if (!overlay) return;
  overlay.classList.remove("is-open");
  overlay.setAttribute("aria-hidden", "true");
}



/* ---------- Init ---------- */

document.addEventListener("DOMContentLoaded", function () {
  console.log("Driver Diagram Tool loaded with header controls and export.");

  var addBtn = document.getElementById("addNodeBtn");
  var clearBtn = document.getElementById("clearAllBtn");
  var downloadBtn = document.getElementById("downloadCsvBtn");
  var uploadInput = document.getElementById("uploadCsvInput");
  var addColorBtn = document.getElementById("addColorBtn");

  var btnToggleControls = document.getElementById("btnToggleControls");
  var btnToggleTable = document.getElementById("btnToggleTable");
  var btnHeaderClear = document.getElementById("btnHeaderClear");
  var btnExportPng = document.getElementById("btnExportPng");
  var btnExportPdf = document.getElementById("btnExportPdf");
  var applyAppearanceBtn = document.getElementById("applyAppearanceBtn");
  var btnHelp = document.getElementById("btnHelp");
  var helpOverlay = document.getElementById("helpOverlay");
  var helpCloseBtn = document.getElementById("helpCloseBtn");

  if (addBtn) addBtn.addEventListener("click", addNodeFromForm);
  if (clearBtn) clearBtn.addEventListener("click", clearAllNodes);
  if (downloadBtn) downloadBtn.addEventListener("click", downloadCsv);
  if (uploadInput) {
    uploadInput.addEventListener("change", function (e) {
      var file = e.target.files && e.target.files[0];
      if (file) {
        uploadCsv(file);
        e.target.value = "";
      }
    });
  }
  if (addColorBtn) {
    addColorBtn.addEventListener("click", function () {
      addColorOptionFromForm();
    });
  }

  if (btnToggleControls) {
    btnToggleControls.addEventListener("click", toggleControlsVisibility);
  }
  if (btnToggleTable) {
    btnToggleTable.addEventListener("click", toggleTableVisibility);
  }
  if (btnHeaderClear) {
    btnHeaderClear.addEventListener("click", clearAllNodes);
  }
  if (btnExportPng) {
    btnExportPng.addEventListener("click", exportDiagramPng);
  }
  if (btnExportPdf) {
    btnExportPdf.addEventListener("click", exportDiagramPdf);
  }
  if (applyAppearanceBtn) {
    applyAppearanceBtn.addEventListener("click", applyDiagramAppearanceFromInputs);
  }

 // Help / info modal
  if (btnHelp) {
    btnHelp.addEventListener("click", function () {
      openHelpOverlay();
    });
  }
  if (helpCloseBtn) {
    helpCloseBtn.addEventListener("click", function () {
      closeHelpOverlay();
    });
  }
  if (helpOverlay) {
    // Close when clicking on the dimmed background
    helpOverlay.addEventListener("click", function (e) {
      if (e.target === helpOverlay) {
        closeHelpOverlay();
      }
    });
  }
  // Optional: close with Escape key
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeHelpOverlay();
    }
  });
	
  var btnToggleLegend = document.getElementById("toggleLegendBtn");

  if (btnToggleLegend) {
    btnToggleLegend.addEventListener("click", function () {
      legendVisible = !legendVisible;
      updateLegendVisibility();
    });
  }


  // Set up collapsible sections in controls panel
  setupCollapsibleSections();

// Ensure an Aim box exists on first load
ensureDefaultAim(); 

// Initial render (using default appearance)
  applyDiagramAppearanceFromInputs();
  setAppearanceInputsFromConfig();

});
