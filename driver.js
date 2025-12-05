// driver.js
// Core logic for the Driver Diagram Tool

var nodes = [];
var nextId = 1;

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

  if (id === undefined || id === null || id === "") {
    id = String(nextId++);
  }

  return {
    id: id,
    level: level,
    text: text,
    parentId: parentId
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

function getLevelLabel(level) {
  if (level === "aim") return "Aim";
  if (level === "primary") return "Primary";
  if (level === "secondary") return "Secondary driver";
  if (level === "change") return "Change idea";
  return level;
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
    byLevel[level] = nodes.filter(function (n) { return n.level === level; });
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

      // Add buttons for parent/child
      var prevLevel = getPreviousLevel(level);
      var nextLevel = getNextLevel(level);

      if (prevLevel) {
        var leftBtn = document.createElement("button");
        leftBtn.type = "button";
        leftBtn.className = "diagram-add diagram-add-left";
        leftBtn.textContent = "+";
        leftBtn.title = "Add " + getLevelLabel(prevLevel) + " (parent)";
        leftBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          addParentForNode(node.id);
        });
        box.appendChild(leftBtn);
      }

      if (nextLevel) {
        var rightBtn = document.createElement("button");
        rightBtn.type = "button";
        rightBtn.className = "diagram-add diagram-add-right";
        rightBtn.textContent = "+";
        rightBtn.title = "Add " + getLevelLabel(nextLevel) + " (child)";
        rightBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          addChildForNode(node.id);
        });
        box.appendChild(rightBtn);
      }

      // Text content in a span so it doesn't interfere with buttons
      var textSpan = document.createElement("span");
      textSpan.textContent = node.text;
      box.appendChild(textSpan);

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

  nodes.forEach(function (node) {
    if (!node.parentId) return;

    var parentEl = canvas.querySelector('.diagram-node[data-id="' + node.parentId + '"]');
    var childEl = canvas.querySelector('.diagram-node[data-id="' + node.id + '"]');
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
      "M " + x1 + " " + y1 +
      " C " + midX + " " + y1 +
      ", " + midX + " " + y2 +
      ", " + x2 + " " + y2;

    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "#999");
    path.setAttribute("stroke-width", "1.5");
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

  if (currentValue && nodes.some(function (n) { return n.id === currentValue; })) {
    parentSelect.value = currentValue;
  }
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

  tableWrapper.style.display = "block";
  noItemsMessage.style.display = "none";

  nodes.forEach(function (node) {
    var tr = document.createElement("tr");

    var tdId = document.createElement("td");
    tdId.textContent = node.id;
    tr.appendChild(tdId);

    var tdLevel = document.createElement("td");
    tdLevel.textContent = getLevelLabel(node.level);
    tr.appendChild(tdLevel);

    var tdParent = document.createElement("td");
    if (node.parentId) {
      var parent = nodes.find(function (n) { return n.id === node.parentId; });
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

function updateAllViews() {
  renderNodesTable();
  refreshParentOptions();
  renderDiagram();
}

/* ---------- Actions from the form ---------- */

function addNodeFromForm() {
  var textEl = document.getElementById("nodeText");
  var levelEl = document.getElementById("nodeLevel");
  var parentEl = document.getElementById("nodeParent");

  if (!textEl || !levelEl || !parentEl) return;

  var text = textEl.value.trim();
  var level = levelEl.value;
  var parentId = parentEl.value;

  if (!text) {
    alert("Please enter some text for this item.");
    return;
  }

  var node = createNode({ level: level, text: text, parentId: parentId });
  nodes.push(node);

  textEl.value = "";
  updateAllViews();
}

/* ---------- Actions from + buttons ---------- */

function addParentForNode(nodeId) {
  var refNode = nodes.find(function (n) { return n.id === nodeId; });
  if (!refNode) return;

  var prevLevel = getPreviousLevel(refNode.level);
  if (!prevLevel) {
    alert("This item is already at the highest level.");
    return;
  }

  var defaultPrompt = "Enter text for new " + getLevelLabel(prevLevel) + " (parent)";
  var text = window.prompt(defaultPrompt, "");
  if (!text) return;

  // New parent inherits old parent (if any)
  var newNode = createNode({
    level: prevLevel,
    text: text.trim(),
    parentId: refNode.parentId
  });

  nodes.push(newNode);

  // Reference node now points to the new parent
  refNode.parentId = newNode.id;

  updateAllViews();
}

function addChildForNode(nodeId) {
  var refNode = nodes.find(function (n) { return n.id === nodeId; });
  if (!refNode) return;

  var nextLevel = getNextLevel(refNode.level);
  if (!nextLevel) {
    // No further level; keep same level for extra children
    nextLevel = refNode.level;
  }

  var defaultPrompt = "Enter text for new " + getLevelLabel(nextLevel) + " (child)";
  var text = window.prompt(defaultPrompt, "");
  if (!text) return;

  var newNode = createNode({
    level: nextLevel,
    text: text.trim(),
    parentId: refNode.id
  });

  nodes.push(newNode);
  updateAllViews();
}

/* ---------- Clear / delete ---------- */

function clearAllNodes() {
  if (!window.confirm("Clear all items from this driver diagram?")) return;
  nodes = [];
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

  nodes = nodes.filter(function (n) { return !toDelete.has(n.id); });
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
    return {
      id: n.id,
      level: n.level,
      parent_id: n.parentId || "",
      text: n.text
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

      rows.forEach(function (row, index) {
        var id = (row.id || "").toString().trim();
        var level = (row.level || "").toString().trim();
        var text = (row.text || "").toString().trim();
        var parentId = (row.parent_id || "").toString().trim();

        if (!id || !level || !text) {
          console.warn("Skipping row " + (index + 1) + " - missing id/level/text.");
          return;
        }

        imported.push({
          id: id,
          level: level,
          text: text,
          parentId: parentId
        });
      });

      nodes = imported;
      updateNextIdFromNodes();
      updateAllViews();
      alert("Loaded " + nodes.length + " items from CSV.");
    }
  });
}

/* ---------- Init ---------- */

document.addEventListener("DOMContentLoaded", function () {
  console.log("Driver Diagram Tool loaded with clickable add buttons.");

  var addBtn = document.getElementById("addNodeBtn");
  var clearBtn = document.getElementById("clearAllBtn");
  var downloadBtn = document.getElementById("downloadCsvBtn");
  var uploadInput = document.getElementById("uploadCsvInput");

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

  updateAllViews();
});
