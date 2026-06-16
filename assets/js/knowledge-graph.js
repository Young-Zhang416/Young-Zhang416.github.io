const STATIC_DATA_URL = "assets/data/knowledge-graph.json";
const API_BASE = String(window.KNOWLEDGE_API_BASE || "").replace(/\/$/, "");

const svg = document.querySelector("#knowledgeGraph");
const detail = document.querySelector(".graph-detail");
const searchInput = document.querySelector("#graphSearch");
const centerButton = document.querySelector('[data-graph-action="center"]');
const floatButton = document.querySelector('[data-graph-action="float"]');

const typeConfig = {
  concept: { label: "知识", color: "#006fc5", fill: "#eef7ff", radius: 34 },
  markdown: { label: "Markdown", color: "#19a58f", fill: "#effffb", radius: 28 },
  pdf: { label: "PDF", color: "#d94d63", fill: "#fff0f3", radius: 28 },
  web: { label: "网页", color: "#6c7cff", fill: "#f3f2ff", radius: 28 },
  file: { label: "文件", color: "#f59e42", fill: "#fff7ec", radius: 28 }
};

let graph = { nodes: [], links: [] };
let selectedId = null;
let floating = true;
let frame = null;
let dimensions = { width: 900, height: 560 };

function resourceType(node) {
  if (node.kind === "concept") return "concept";
  const url = (node.url || "").toLowerCase();
  if (url.startsWith("http://") || url.startsWith("https://")) return "web";
  if (url.endsWith(".md") || url.endsWith(".markdown")) return "markdown";
  if (url.endsWith(".pdf")) return "pdf";
  return "file";
}

function normalizeGraph(data) {
  const nodes = data.nodes.map((node, index) => {
    const type = resourceType(node);
    const angle = (index / Math.max(data.nodes.length, 1)) * Math.PI * 2;
    const orbit = 150 + (index % 3) * 38;
    return {
      ...node,
      type,
      radius: typeConfig[type].radius,
      x: dimensions.width / 2 + Math.cos(angle) * orbit,
      y: dimensions.height / 2 + Math.sin(angle) * orbit,
      vx: 0,
      vy: 0
    };
  });
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const links = data.links
    .map((link) => ({ ...link, sourceNode: nodeMap.get(link.source), targetNode: nodeMap.get(link.target) }))
    .filter((link) => link.sourceNode && link.targetNode);
  return { nodes, links };
}

function fitGraph() {
  const rect = svg.getBoundingClientRect();
  dimensions = {
    width: Math.max(320, Math.round(rect.width || svg.clientWidth || 900)),
    height: Math.max(420, Math.round(rect.height || svg.clientHeight || 560))
  };
  svg.setAttribute("viewBox", `0 0 ${dimensions.width} ${dimensions.height}`);
}

function render() {
  svg.replaceChildren();

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  defs.innerHTML = `
    <filter id="nodeGlow" x="-80%" y="-80%" width="260%" height="260%">
      <feDropShadow dx="0" dy="8" stdDeviation="9" flood-color="#4470b0" flood-opacity="0.18"/>
    </filter>
  `;
  svg.appendChild(defs);

  const linkLayer = createSvg("g", { class: "graph-links" });
  const nodeLayer = createSvg("g", { class: "graph-nodes" });
  svg.append(linkLayer, nodeLayer);

  graph.links.forEach((link) => {
    const line = createSvg("line", { class: "graph-link" });
    const label = createSvg("text", { class: "graph-link-label" });
    label.textContent = link.label || "";
    link.element = line;
    link.labelElement = label;
    linkLayer.append(line, label);
  });

  graph.nodes.forEach((node) => {
    const config = typeConfig[node.type];
    const group = createSvg("g", {
      class: `graph-node ${node.type}`,
      tabindex: "0",
      role: node.kind === "resource" ? "link" : "button",
      "aria-label": node.label
    });
    const halo = createSvg("circle", { class: "node-halo", r: node.radius + 10 });
    const circle = createSvg("circle", {
      class: "node-core",
      r: node.radius,
      fill: config.fill,
      stroke: config.color
    });
    const type = createSvg("text", { class: "node-type", y: -4 });
    type.textContent = config.label;
    const label = createSvg("text", { class: "node-label", y: 14 });
    label.textContent = trimLabel(node.label);
    group.append(halo, circle, type, label);
    group.addEventListener("pointerdown", (event) => startDrag(event, node));
    group.addEventListener("click", () => selectNode(node, true));
    group.addEventListener("keydown", (event) => {
      if (event.key === "Enter") selectNode(node, true);
    });
    node.element = group;
    nodeLayer.appendChild(group);
  });
}

function createSvg(name, attrs = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function trimLabel(label) {
  return label.length > 9 ? `${label.slice(0, 8)}…` : label;
}

function tick() {
  const centerX = dimensions.width / 2;
  const centerY = dimensions.height / 2;
  const query = searchInput.value.trim().toLowerCase();

  graph.nodes.forEach((node) => {
    if (!node.dragging) {
      const strength = node.kind === "concept" ? 0.006 : 0.0038;
      node.vx += (centerX - node.x) * strength;
      node.vy += (centerY - node.y) * strength;
      if (floating) {
        node.vx += Math.sin(Date.now() / 900 + node.x * 0.01) * 0.025;
        node.vy += Math.cos(Date.now() / 1100 + node.y * 0.01) * 0.025;
      }
    }
  });

  graph.links.forEach((link) => {
    const source = link.sourceNode;
    const target = link.targetNode;
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.hypot(dx, dy) || 1;
    const desired = source.kind === "concept" && target.kind === "concept" ? 165 : 128;
    const force = (distance - desired) * 0.004;
    const fx = (dx / distance) * force;
    const fy = (dy / distance) * force;
    if (!source.dragging) {
      source.vx += fx;
      source.vy += fy;
    }
    if (!target.dragging) {
      target.vx -= fx;
      target.vy -= fy;
    }
  });

  for (let i = 0; i < graph.nodes.length; i += 1) {
    for (let j = i + 1; j < graph.nodes.length; j += 1) {
      const a = graph.nodes[i];
      const b = graph.nodes[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.max(Math.hypot(dx, dy), 1);
      const min = a.radius + b.radius + 28;
      if (distance < min) {
        const push = (min - distance) * 0.012;
        const fx = (dx / distance) * push;
        const fy = (dy / distance) * push;
        if (!a.dragging) {
          a.vx -= fx;
          a.vy -= fy;
        }
        if (!b.dragging) {
          b.vx += fx;
          b.vy += fy;
        }
      }
    }
  }

  graph.nodes.forEach((node) => {
    if (!node.dragging) {
      node.vx *= 0.88;
      node.vy *= 0.88;
      node.x += node.vx;
      node.y += node.vy;
    }
    node.x = Math.min(dimensions.width - node.radius - 10, Math.max(node.radius + 10, node.x));
    node.y = Math.min(dimensions.height - node.radius - 10, Math.max(node.radius + 10, node.y));
    node.element.setAttribute("transform", `translate(${node.x}, ${node.y})`);
    node.element.classList.toggle("selected", node.id === selectedId);
    node.element.classList.toggle("dimmed", query && !matchesQuery(node, query));
  });

  graph.links.forEach((link) => {
    const { sourceNode: source, targetNode: target } = link;
    link.element.setAttribute("x1", source.x);
    link.element.setAttribute("y1", source.y);
    link.element.setAttribute("x2", target.x);
    link.element.setAttribute("y2", target.y);
    link.labelElement.setAttribute("x", (source.x + target.x) / 2);
    link.labelElement.setAttribute("y", (source.y + target.y) / 2 - 8);
  });

  frame = requestAnimationFrame(tick);
}

function matchesQuery(node, query) {
  return [node.label, node.description, node.type, ...(node.tags || [])]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function selectNode(node, openResource = false) {
  selectedId = node.id;
  const config = typeConfig[node.type];
  detail.innerHTML = `
    <p class="eyebrow">${config.label}</p>
    <h2>${escapeHtml(node.label)}</h2>
    <p>${escapeHtml(node.description || "暂无说明。")}</p>
    ${(node.tags || []).length ? `<div class="node-tags">${node.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
    ${node.url ? `<a class="button primary" href="${escapeAttribute(node.url)}" ${node.url.startsWith("http") ? 'target="_blank" rel="noreferrer"' : ""}>打开资源</a>` : ""}
  `;
  if (openResource && node.kind === "resource" && node.url) {
    window.open(node.url, node.url.startsWith("http") ? "_blank" : "_self");
  }
}

function startDrag(event, node) {
  event.preventDefault();
  node.dragging = true;
  node.element.setPointerCapture(event.pointerId);
  const point = svgPoint(event);
  const offsetX = point.x - node.x;
  const offsetY = point.y - node.y;

  function move(moveEvent) {
    const next = svgPoint(moveEvent);
    node.x = next.x - offsetX;
    node.y = next.y - offsetY;
    node.vx = 0;
    node.vy = 0;
  }

  function end() {
    node.dragging = false;
    node.element.removeEventListener("pointermove", move);
    node.element.removeEventListener("pointerup", end);
    node.element.removeEventListener("pointercancel", end);
  }

  node.element.addEventListener("pointermove", move);
  node.element.addEventListener("pointerup", end);
  node.element.addEventListener("pointercancel", end);
}

function svgPoint(event) {
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  return point.matrixTransform(svg.getScreenCTM().inverse());
}

function centerGraph() {
  graph.nodes.forEach((node, index) => {
    const angle = (index / Math.max(graph.nodes.length, 1)) * Math.PI * 2;
    const orbit = node.kind === "concept" ? 145 : 230;
    node.x = dimensions.width / 2 + Math.cos(angle) * orbit;
    node.y = dimensions.height / 2 + Math.sin(angle) * orbit;
    node.vx = 0;
    node.vy = 0;
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

async function init() {
  fitGraph();
  graph = normalizeGraph(await loadGraphData());
  render();
  centerGraph();
  tick();
}

async function loadGraphData() {
  if (API_BASE) {
    try {
      const response = await fetch(`${API_BASE}/api/graph`);
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      return await response.json();
    } catch (error) {
      console.warn("Knowledge API unavailable, falling back to static graph.", error);
    }
  }
  const response = await fetch(STATIC_DATA_URL);
  if (!response.ok) throw new Error(`Static graph returned ${response.status}`);
  return response.json();
}

window.addEventListener("resize", () => {
  fitGraph();
  centerGraph();
});

searchInput.addEventListener("input", () => {});
centerButton.addEventListener("click", centerGraph);
floatButton.addEventListener("click", () => {
  floating = !floating;
  floatButton.textContent = floating ? "浮动" : "静止";
});

init().catch((error) => {
  if (frame) cancelAnimationFrame(frame);
  detail.innerHTML = `<p class="eyebrow">Error</p><h2>图谱加载失败</h2><p>${escapeHtml(error.message)}</p>`;
});
