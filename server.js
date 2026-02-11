const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8000;
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "complaints.json");

app.use(cors());
app.use(express.json({ limit: "10mb" }));

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, "[]", "utf8");
  }
}

function readAll() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (err) {
    return [];
  }
}

function writeAll(list) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), "utf8");
}

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function sortByCreatedAtDesc(list) {
  return list.sort((a, b) => {
    const ta = new Date(a.created_at || 0).getTime() || 0;
    const tb = new Date(b.created_at || 0).getTime() || 0;
    return tb - ta;
  });
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get("/api/complaints", (req, res) => {
  const list = sortByCreatedAtDesc(readAll());
  res.json(list);
});

app.post("/api/complaints", (req, res) => {
  const payload = req.body;
  if (!payload || typeof payload !== "object") {
    return res.status(400).json({ error: "无效请求" });
  }

  const item = {
    ...payload,
    id: payload.id || makeId(),
    created_at: payload.created_at || new Date().toISOString(),
  };

  const list = readAll();
  list.unshift(item);
  writeAll(list);
  res.status(201).json(item);
});

app.delete("/api/complaints/:id", (req, res) => {
  const id = req.params.id;
  const list = readAll();
  const next = list.filter((item) => item.id !== id);
  if (next.length === list.length) {
    return res.status(404).json({ error: "未找到该记录" });
  }
  writeAll(next);
  res.json({ ok: true });
});

app.delete("/api/complaints", (req, res) => {
  writeAll([]);
  res.json({ ok: true });
});

app.use("/", express.static(__dirname, { extensions: ["html"] }));

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
