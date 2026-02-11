const DEFAULT_API_BASE = "https://complaints-api.rl-longdragon.workers.dev";
const API_BASE_KEY = "apiBase";
const API_KEY_KEY = "apiKey";

function getApiBase() {
  const stored = wx.getStorageSync(API_BASE_KEY);
  return stored || DEFAULT_API_BASE;
}

function setApiBase(base) {
  if (base) {
    wx.setStorageSync(API_BASE_KEY, base);
  } else {
    wx.removeStorageSync(API_BASE_KEY);
  }
}

function getApiKey() {
  return wx.getStorageSync(API_KEY_KEY) || "";
}

function setApiKey(key) {
  if (key) {
    wx.setStorageSync(API_KEY_KEY, key);
  } else {
    wx.removeStorageSync(API_KEY_KEY);
  }
}

function apiUrl(path) {
  const base = getApiBase();
  if (!base) return path;
  return `${base.replace(/\/+$/, "")}${path}`;
}

function apiHeaders() {
  const headers = {};
  const apiKey = getApiKey();
  if (apiKey) headers["X-API-Key"] = apiKey;
  return headers;
}

function request({ url, method = "GET", data, headers = {} }) {
  return new Promise((resolve) => {
    wx.request({
      url: apiUrl(url),
      method,
      data,
      header: headers,
      success: (res) => resolve(res),
      fail: (err) => resolve({ statusCode: 0, errMsg: err.errMsg })
    });
  });
}

async function postComplaint(payload) {
  const res = await request({
    url: "/api/complaints",
    method: "POST",
    data: payload,
    headers: { "Content-Type": "application/json", ...apiHeaders() }
  });
  if (res.statusCode >= 200 && res.statusCode < 300) {
    return { ok: true, data: res.data };
  }
  return { ok: false, error: (res.data && res.data.error) || "提交失败" };
}

async function fetchComplaints() {
  const res = await request({
    url: "/api/complaints",
    headers: apiHeaders()
  });
  if (res.statusCode >= 200 && res.statusCode < 300) {
    return { ok: true, data: Array.isArray(res.data) ? res.data : [] };
  }
  return { ok: false, error: "无法获取列表" };
}

async function deleteComplaint(id) {
  const res = await request({
    url: `/api/complaints/${encodeURIComponent(id)}`,
    method: "DELETE",
    headers: apiHeaders()
  });
  if (res.statusCode >= 200 && res.statusCode < 300) {
    return { ok: true };
  }
  return { ok: false, error: (res.data && res.data.error) || "删除失败" };
}

async function clearComplaints() {
  const res = await request({
    url: "/api/complaints",
    method: "DELETE",
    headers: apiHeaders()
  });
  if (res.statusCode >= 200 && res.statusCode < 300) {
    return { ok: true };
  }
  return { ok: false, error: (res.data && res.data.error) || "清空失败" };
}

module.exports = {
  getApiBase,
  setApiBase,
  getApiKey,
  setApiKey,
  apiUrl,
  postComplaint,
  fetchComplaints,
  deleteComplaint,
  clearComplaints
};
