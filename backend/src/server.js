import cors from "cors";
import express from "express";
import multer from "multer";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const dataPath = path.join(rootDir, "data", "graph.json");
const uploadDir = path.join(rootDir, "uploads");
const port = Number(process.env.PORT || 8787);

const app = express();
const upload = multer({ dest: uploadDir });

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(uploadDir));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/graph", async (_req, res, next) => {
  try {
    res.json(await readGraph());
  } catch (error) {
    next(error);
  }
});

app.post("/api/nodes", async (req, res, next) => {
  try {
    const graph = await readGraph();
    const node = normalizeNode(req.body);
    upsertById(graph.nodes, node);
    await writeGraph(graph);
    res.status(201).json(node);
  } catch (error) {
    next(error);
  }
});

app.post("/api/resources", async (req, res, next) => {
  try {
    const graph = await readGraph();
    const resource = normalizeResource(req.body);
    upsertById(graph.nodes, resource.node);
    if (resource.link) upsertLink(graph.links, resource.link);
    await writeGraph(graph);
    res.status(201).json(resource);
  } catch (error) {
    next(error);
  }
});

app.post("/api/resources/upload", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "Missing file field." });
      return;
    }

    const graph = await readGraph();
    const originalName = req.file.originalname || req.file.filename;
    const safeName = safeFilename(originalName);
    const publicUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    const parentId = req.body.parentId || "abstract-algebra";
    const node = {
      id: uniqueId(`res-${path.parse(safeName).name}`, graph.nodes),
      label: req.body.label || path.parse(originalName).name,
      kind: "resource",
      url: publicUrl,
      description: req.body.description || `${fileTypeLabel(originalName)} 资源：${originalName}`,
      tags: [fileTypeTag(originalName), "upload"]
    };
    const link = { source: parentId, target: node.id, label: "resource" };

    graph.nodes.push(node);
    upsertLink(graph.links, link);
    await writeGraph(graph);
    res.status(201).json({ node, link });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  res.status(500).json({ error: error.message });
});

await mkdir(path.dirname(dataPath), { recursive: true });
await mkdir(uploadDir, { recursive: true });

app.listen(port, () => {
  console.log(`Knowledge graph API listening on http://localhost:${port}`);
});

async function readGraph() {
  const content = await readFile(dataPath, "utf8");
  return JSON.parse(content);
}

async function writeGraph(graph) {
  await writeFile(dataPath, `${JSON.stringify(graph, null, 2)}\n`, "utf8");
}

function normalizeNode(input) {
  if (!input?.id || !input?.label) {
    throw new Error("Node requires id and label.");
  }
  return {
    id: String(input.id),
    label: String(input.label),
    kind: input.kind === "resource" ? "resource" : "concept",
    url: input.url ? String(input.url) : undefined,
    description: input.description ? String(input.description) : "",
    tags: Array.isArray(input.tags) ? input.tags.map(String) : []
  };
}

function normalizeResource(input) {
  if (!input?.label || !input?.url) {
    throw new Error("Resource requires label and url.");
  }
  const node = {
    id: input.id ? String(input.id) : slugResourceId(input.label),
    label: String(input.label),
    kind: "resource",
    url: String(input.url),
    description: input.description ? String(input.description) : "",
    tags: Array.isArray(input.tags) ? input.tags.map(String) : [fileTypeTag(input.url)]
  };
  const link = input.parentId ? { source: String(input.parentId), target: node.id, label: input.linkLabel || "resource" } : null;
  return { node, link };
}

function upsertById(items, nextItem) {
  const index = items.findIndex((item) => item.id === nextItem.id);
  if (index >= 0) items[index] = { ...items[index], ...nextItem };
  else items.push(nextItem);
}

function upsertLink(links, nextLink) {
  const exists = links.some((link) => link.source === nextLink.source && link.target === nextLink.target);
  if (!exists) links.push(nextLink);
}

function slugResourceId(label) {
  return `res-${String(label).trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-").replace(/^-|-$/g, "")}`;
}

function uniqueId(base, nodes) {
  const clean = slugResourceId(base.replace(/^res-/, ""));
  let id = clean;
  let index = 2;
  while (nodes.some((node) => node.id === id)) {
    id = `${clean}-${index}`;
    index += 1;
  }
  return id;
}

function safeFilename(name) {
  return String(name).replace(/[\\/:*?"<>|]+/g, "-");
}

function fileTypeTag(name) {
  const ext = path.extname(String(name)).toLowerCase();
  if (ext === ".md" || ext === ".markdown") return "markdown";
  if (ext === ".pdf") return "pdf";
  if (ext === ".html" || ext === ".htm" || String(name).startsWith("http")) return "web";
  return "file";
}

function fileTypeLabel(name) {
  const tag = fileTypeTag(name);
  if (tag === "markdown") return "Markdown";
  if (tag === "pdf") return "PDF";
  if (tag === "web") return "网页";
  return "文件";
}
