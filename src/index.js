const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders,
    },
  });
}

function normalizeCategories(input) {
  if (Array.isArray(input)) return input;
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {}
  }
  return [];
}

function toDbCategories(input) {
  const list = normalizeCategories(input);
  return list.length ? JSON.stringify(list) : null;
}

function rowToItem(row) {
  return {
    ...row,
    categories: normalizeCategories(row.categories),
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (pathname === "/api/health") {
      return json({ ok: true, time: new Date().toISOString() });
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
        return json({ error: "无效的 JSON" }, 400);
      }
      if (!payload || typeof payload !== "object") {
        return json({ error: "无效请求" }, 400);
      }

      const id = payload.id || crypto.randomUUID();
      const createdAt = payload.created_at || new Date().toISOString();
      const categories = toDbCategories(payload.categories);
      const emotionValue =
        payload.emotion_value ?? payload.emotionValue ?? null;

      await env.DB.prepare(
        "INSERT INTO complaints (id, created_at, mode, subject, scene, problem, impact, wish, emotion, emotion_value, visibility, categories, severity, summary, detail, contact, attachment_name, attachment_data, sentence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
        .bind(
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
        )
        .run();

      return json(
        rowToItem({
          ...payload,
          id,
          created_at: createdAt,
          categories,
          emotion_value: emotionValue,
        }),
        201
      );
    }

    if (pathname.startsWith("/api/complaints/") && request.method === "DELETE") {
      const id = decodeURIComponent(pathname.replace("/api/complaints/", ""));
      if (!id) return json({ error: "缺少记录ID" }, 400);
      const result = await env.DB.prepare(
        "DELETE FROM complaints WHERE id = ?"
      )
        .bind(id)
        .run();
      if (!result || !result.meta || result.meta.changes === 0) {
        return json({ error: "未找到该记录" }, 404);
      }
      return json({ ok: true });
    }

    if (pathname === "/api/complaints" && request.method === "DELETE") {
      await env.DB.prepare("DELETE FROM complaints").run();
      return json({ ok: true });
    }

    return json({ error: "Not found" }, 404);
  },
};
