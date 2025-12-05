// driver.js
// Core logic for the Driver Diagram Tool

let nodes = [];
let nextId = 1;

function createNode({ id, level, text, parentId }) {
  return {
    id: id ?? String(nextId++),
    level,
    text,
    parentId: parentId || ""
  };
}

function updateNextIdFromNodes() {
  if (nodes.length === 0) {
    nextId = 1;
    return;
  }
  const maxId = nodes.reduce((max, n) => {
    const numeric = parseInt(n.id, 10);
    return Number.isNaN(numeric) ? max : Math.max(max, numeric);
  }, 0);
  nextId = maxId + 1;
}

function getLevelLabel(level) {
  switch (level) {
    case "aim":
      return "Aim";
    case "primary":
      return "Primary";
    case "secondary":
      return "Secondary";
    case "change":
      return "Change idea";
    default:
      return level;
  }
}

function refreshParentOptions() {
  const parentSelect = document.getElementById("nodeParent");
  if (!parentSelect) return;

  const currentValue = parentSelect.value;

  // Reset options
  parentSelect.innerHTML = "";
  const noneOption = document.createElement("option");
  noneOption.value = "";
  noneOption.textContent = "— None / top level —";
  parentSelect.appendChild(noneOption);

  nodes.forEach((node) => {
    const opt = document.createElement("option");
    opt.value = node.id;
    const shortText = node.text.length > 50
      ? node.text.slice(0, 47) + "…"
      : node.text;
    opt.textContent = `[${node.id}] ${getLevelLabel(node.level)} – ${shortText}`;
    parentSelect.appendChild(opt);
  });

  // Try to preserve previous selection if still valid
  if (currentValue && nodes.some((n) => n.id === currentValue)) {
    parentSelect.value = currentValue;
  }
}

function renderNodesTable() {
  const tableWrapper = document.getElementById("nodesTableWrapper");
  const tbody = document.getElementById("nodesTableBody");
  const noItemsMessage = document.getElementById("noItemsMessage");

  if (!tableWrapper || !tbody || !noItemsMessage) return;

  tbody.innerHTML = "";

  if (nodes.length === 0) {
    tableWrapper.style.display = "none";
    noItemsMessage.style.display = "block";
    return;
  }

  tableWrapper.style.display = "block";
  noItemsMessage.style.display = "none";

  nodes.forEach((node) => {
    const tr = document.createElement("tr");

    const tdId = document.createElement("td");
    tdId.textContent = node.id;
    tr.appendChild(tdId);

    const tdLevel = document.createElement("td");
    tdLevel.textContent = getLevelLabel(node.level);
    tr.appendChild(tdLevel);

    const tdParent = document.createElement("td");
    if (node.parentId) {
      const parent = nodes.find((n) => n.id === node.parentId);
      tdParent.textContent = parent
        ? `[${parent.id}] ${getLevelLabel(parent.level)}`
        : `(Missing: ${node.parentId})`;
    } else {
      tdParent.textContent = "—";
    }
    tr.appendChild(tdParent);

    const tdText = document.createElement("td");
    tdText.textContent = node.text;
    tr.appendChild(tdText);

    const tdActions = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.className = "danger";
    delBtn.style.padding = "0.25rem 0.5rem";
    delBtn.style.fontSize = "0.8rem";
    delBtn.addEventListener("click", () => {
      deleteNode(node.id);
    });
    tdActions.appendChild(delBtn);
    tr.appendChild(tdActions);

    tbody.append
