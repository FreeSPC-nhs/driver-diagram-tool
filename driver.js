// driver.js
// Core logic for the Driver Diagram Tool

var nodes = [];
var nextId = 1;
var connections = [];

// Colour options: { label, value } where value is a hex colour (e.g. "#ffcc00")
var colorOptions = [];
var editingColorIndex = -1; // which colour option is being edited (if any)

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

    var labelText = (index + 1) + ". " + opt.label + " (" + opt.value + ")";
    li.textContent = labelText;

    if (index === editingColorIndex) {
      li.style.fontWeight = "600";
      li.style.textDecoration = "underline";
    }

    li.addEventListener("click", function () {
      var labelInput = document.getElementById("colorLabelInput");
      var valueInput = document.getElementById("colorValueInput");
      if (!labelInput || !valueInput) return;

      editingColorIndex = index;
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
  if (!label) {
    label = "Colour " + (colorOptions.length + 1);
  }

  if (editingColorIndex >= 0 && editingColorIndex < colorOptions.length) {
    // Editing existing colour option
    var oldValue = colorOptions[editingColorIndex].value;
    colorOptions[editingColorIndex].label = label;
    colorOptions[editingColorIndex].value = value;

    // Update any nodes using the old colour value
    nodes.forEach(function (n) {
      if (n.color === oldValue) {
        n.color = value;
      }
    });

    editingColorIndex = -1;
  } else {
    // Creating / updating by colour value
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
  // keep the last chosen colour in the colour picker

  updateAllViews();
}

// When importing CSV, we may see colour values that aren't in colorOptions yet.
// Build default labels like "Colour 1", "Colour 2", ...
function rebuildColorOptionsFromNodes() {
  var seen = {};
  nodes.forEach(function (n) {
    if (n.color) {
      seen[n.color] = true;
    }
  });

  colorOptions = [];
  var index = 1;
  for (var value in seen) {
    if (!seen.hasOwnProperty(value)) continue;
    colorOptions.push({
      label: "Colour " + index,
      value: value
    });
    index++;
  }

  editingColorIndex = -1;
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
    labelSpan.textContent = opt.label + " (" + opt.value + ")";

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
  var levelTitles = {
    aim: "Aim",
    primary: "Primary drivers",
    secondary: "Secondary drivers",
    change: "Change ideas"
  };

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

    var title = document.createElement("div");
    title.className = "diagram-column-title";
    title.textContent = levelTitles[level];
    col.appendChild(title);

    byLevel[level].forEach(function (node) {
      var box = document.createElement("div");
      box.className = "diagram-node level-" + level;
      box.setAttribute("data-id", node.id);

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

	if (prevLevel) {
        var leftBtn = document.createElement("button");
        leftBtn.type = "button";
        leftBtn.className = "diagram-add diagram-add-left";
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
          "Connect this item to an existing " + getLevelLabel(prevLevel);
        leftBtn.setAttribute(
          "aria-label",
          "Connect to existing " + getLevelLabel(prevLevel)
        );
        leftBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          addConnectionForNode(node.id);
        });
        box.appendChild(leftBtn);
      }


      if (nextLevel) {
        var rightBtn = document.createElement("button");
        rightBtn.type = "button";
        rightBtn.className = "diagram-add diagram-add-right";
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


      col.appendChild(box);
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

    svg.setAttribute("width", canvasRect.width);
  svg.setAttribute("height", canvasRect.height);

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
  var headers = document.querySelectorAll(".collapsible-header");
  headers.forEach(function (header) {
    var targetId = header.dataset.target;
    var section = targetId ? document.getElementById(targetId) : null;
    var indicator = header.querySelector(".collapsible-indicator");
    if (!section) return;

    header.addEventListener("click", function () {
      var collapsed = section.classList.toggle("is-collapsed");
      if (indicator) {
        indicator.textContent = collapsed ? "▸" : "▾";
      }
    });
  });
}


function updateAllViews() {
  renderNodesTable();
  refreshParentOptions();
  renderDiagram();
  refreshColorSelect();
  renderColorOptionsList();
  renderLegend();
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

/* ---------- Clear / delete ---------- */

function clearAllNodes() {
  if (!window.confirm("Clear all items from this driver diagram?")) return;
  nodes = [];
  connections = [];
  updateNextIdFromNodes();
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
      extra_parents: extraParents.join(";")
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

            var extraConnectionsRaw = []; // temp storage: { childId, parents[] }

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
      });


      nodes = imported;
      updateNextIdFromNodes();
      rebuildColorOptionsFromNodes();
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

function exportDiagramPng() {
  var exportArea = document.getElementById("exportArea");
  if (!exportArea) {
    alert("Could not find diagram to export.");
    return;
  }

  // Hide badges during export
  exportArea.classList.add("hide-badges");

  html2canvas(exportArea).then(function (canvas) {
    exportArea.classList.remove("hide-badges");

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
  }).catch(function (err) {
    exportArea.classList.remove("hide-badges");
    console.error(err);
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
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: "mm", format: "a4", orientation: "landscape" }
  };

  // Hide badges during export
  exportArea.classList.add("hide-badges");

  html2pdf().set(opt).from(exportArea).save().then(function () {
    exportArea.classList.remove("hide-badges");
  }).catch(function (err) {
    exportArea.classList.remove("hide-badges");
    console.error(err);
  });
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

  // Set up collapsible sections in controls panel
  setupCollapsibleSections();

  // Initial render
  updateAllViews();
});
