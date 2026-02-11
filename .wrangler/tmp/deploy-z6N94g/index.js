var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
  "Access-Control-Max-Age": "86400"
};
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders
    }
  });
}
__name(json, "json");
function normalizeCategories(input) {
  if (Array.isArray(input)) return input;
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
    }
  }
  return [];
}
__name(normalizeCategories, "normalizeCategories");
function toDbCategories(input) {
  const list = normalizeCategories(input);
  return list.length ? JSON.stringify(list) : null;
}
__name(toDbCategories, "toDbCategories");
function rowToItem(row) {
  return {
    ...row,
    categories: normalizeCategories(row.categories)
  };
}
__name(rowToItem, "rowToItem");
function getApiKey(request) {
  const url = new URL(request.url);
  return (request.headers.get("X-API-Key") || url.searchParams.get("key") || "").trim();
}
__name(getApiKey, "getApiKey");
function requireKey(request, env) {
  const required = env.API_KEY;
  if (!required) return null;
  const provided = getApiKey(request);
  if (!provided || provided !== required) {
    return json({ error: "Unauthorized" }, 401);
  }
  return null;
}
__name(requireKey, "requireKey");
var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (pathname === "/api/health") {
      return json({ ok: true, time: (/* @__PURE__ */ new Date()).toISOString() });
    }
    if (pathname === "/api/admin/verify" && request.method === "GET") {
      const guard = requireKey(request, env);
      if (guard) return guard;
      return json({ ok: true });
    }
    if (pathname === "/api/complaints" && request.method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT id, created_at, mode, subject, scene, problem, impact, wish, emotion, emotion_value, visibility, categories, severity, summary, detail, contact, attachment_name, attachment_data, sentence FROM complaints ORDER BY created_at DESC"
      ).all();
      return json((results || []).map(rowToItem));
    }
    if (pathname === "/api/complaints" && request.method === "POST") {
      let payload;
      try {
        payload = await request.json();
      } catch (e) {
        return json({ error: "\u65E0\u6548\u7684 JSON" }, 400);
      }
      if (!payload || typeof payload !== "object") {
        return json({ error: "\u65E0\u6548\u8BF7\u6C42" }, 400);
      }
      const id = payload.id || crypto.randomUUID();
      const createdAt = payload.created_at || (/* @__PURE__ */ new Date()).toISOString();
      const categories = toDbCategories(payload.categories);
      const emotionValue = payload.emotion_value ?? payload.emotionValue ?? null;
      await env.DB.prepare(
        "INSERT INTO complaints (id, created_at, mode, subject, scene, problem, impact, wish, emotion, emotion_value, visibility, categories, severity, summary, detail, contact, attachment_name, attachment_data, sentence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        id,
        createdAt,
        payload.mode || null,
        payload.subject || null,
        payload.scene || null,
        payload.problem || null,
        payload.impact || null,
        payload.wish || null,
        payload.emotion || null,
        emotionValue || null,
        payload.visibility || null,
        categories,
        payload.severity || null,
        payload.summary || null,
        payload.detail || null,
        payload.contact || null,
        payload.attachment_name || null,
        payload.attachment_data || null,
        payload.sentence || null
      ).run();
      return json(
        rowToItem({
          ...payload,
          id,
          created_at: createdAt,
          categories,
          emotion_value: emotionValue
        }),
        201
      );
    }
    if (pathname.startsWith("/api/complaints/") && request.method === "DELETE") {
      const guard = requireKey(request, env);
      if (guard) return guard;
      const id = decodeURIComponent(pathname.replace("/api/complaints/", ""));
      if (!id) return json({ error: "\u7F3A\u5C11\u8BB0\u5F55ID" }, 400);
      const result = await env.DB.prepare(
        "DELETE FROM complaints WHERE id = ?"
      ).bind(id).run();
      if (!result || !result.meta || result.meta.changes === 0) {
        return json({ error: "\u672A\u627E\u5230\u8BE5\u8BB0\u5F55" }, 404);
      }
      return json({ ok: true });
    }
    if (pathname === "/api/complaints" && request.method === "DELETE") {
      const guard = requireKey(request, env);
      if (guard) return guard;
      await env.DB.prepare("DELETE FROM complaints").run();
      return json({ ok: true });
    }
    return json({ error: "Not found" }, 404);
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
