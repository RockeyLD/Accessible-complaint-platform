const {
  fetchComplaints,
  deleteComplaint,
  clearComplaints,
  getApiKey,
  setApiKey,
  verifyAdminKey
} = require("../../utils/api");

const themeOptions = [
  { value: "warm", label: "暖晨橙绿" },
  { value: "sea", label: "海风蓝绿" },
  { value: "sun", label: "日光米黄" },
  { value: "stone", label: "清爽灰白" }
];

const THEME_KEY = "list-theme-pref";
const FONT_SIZE_KEY = "list-font-size";
const CONTRAST_KEY = "list-contrast";

function formatDate(value) {
  if (!value) return "未知时间";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (num) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function getSearchableText(raw, normalized) {
  return [
    raw.subject,
    raw.problem,
    raw.impact,
    raw.wish,
    raw.scene,
    raw.summary,
    raw.detail,
    raw.contact,
    raw.sentence,
    raw.mode,
    (raw.categories || []).join(" "),
    normalized.title,
    normalized.detail,
    normalized.meta
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getReportSearchableText(item) {
  return `${item.title || ""} ${item.detail || ""} ${item.meta || ""}`.toLowerCase();
}

function filterByKeyword(list, keyword, getText) {
  const key = (keyword || "").trim().toLowerCase();
  if (!key) return list;
  return list.filter((item) => (getText ? getText(item) : "").includes(key));
}

function truncateText(text, maxLen = 60) {
  const cleaned = (text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.length > maxLen ? `${cleaned.slice(0, maxLen)}...` : cleaned;
}

function collectTags(list) {
  const map = new Map();
  list.forEach((item) => {
    const raw = item.meta || "";
    raw
      .split(/\s*·\s*|\s*[\/|、·]\s*/)
      .forEach((tag) => {
        const t = tag.trim();
        if (!t) return;
        map.set(t, (map.get(t) || 0) + 1);
      });
  });
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
}

function buildReport(aspect, scopeList, scopeKeyword) {
  const scopeLabel = scopeKeyword ? `当前筛选「${scopeKeyword}」范围` : "全部吐槽";
  const aspectList = filterByKeyword(scopeList, aspect, getReportSearchableText);
  const total = scopeList.length;
  const matched = aspectList.length;
  const ratio = total ? Math.round((matched / total) * 100) : 0;
  const lines = [];

  lines.push(`报告主题：${aspect}`);
  lines.push(`生成时间：${new Date().toLocaleString()}`);
  lines.push(`范围：${scopeLabel}`);
  lines.push(`总体概览：共 ${total} 条吐槽，其中与「${aspect}」相关 ${matched} 条（${ratio}%）。`);

  if (matched === 0) {
    lines.push("提示：未找到匹配该方面的记录，请尝试更具体的关键词。");
    return lines.join("\n");
  }

  const topTags = collectTags(aspectList)
    .slice(0, 5)
    .map(([tag, count]) => `${tag}（${count}）`);
  if (topTags.length) {
    lines.push(`高频标签：${topTags.join("、")}`);
  }

  const highlights = aspectList.slice(0, 3).map((item, index) => {
    const detail = truncateText(item.detail, 70);
    const meta = item.meta ? ` | ${item.meta}` : "";
    return `${index + 1}. ${item.title}${meta}${detail ? `：${detail}` : ""}`;
  });
  if (highlights.length) {
    lines.push("代表吐槽：");
    lines.push(...highlights);
  }

  return lines.join("\n\n");
}

function parseAttachment(item) {
  const data = item.attachment_data || item.attachmentData || null;
  if (!data) return null;
  const name = item.attachment_name || item.attachmentName || "附件";
  let type = "file";
  if (data.startsWith("data:image/")) type = "image";
  else if (data.startsWith("data:video/")) type = "video";
  else if (data.startsWith("data:audio/")) type = "audio";
  return { data, name, type };
}

function normalizeItem(item) {
  const title = item.sentence || item.summary || item.subject || "无标题吐槽";
  const detail = item.detail || item.problem || "";
  const metaParts = [];
  if (item.scene) metaParts.push(item.scene);
  if (item.severity) metaParts.push(item.severity);
  if (item.impact) metaParts.push(item.impact);
  if (item.wish) metaParts.push(item.wish);
  if (item.visibility) metaParts.push(`公开：${item.visibility}`);
  if (item.emotion) metaParts.push(`情绪：${item.emotion}`);
  if (Array.isArray(item.categories) && item.categories.length) {
    metaParts.push(`类别：${item.categories.join("、")}`);
  }
  const attachment = parseAttachment(item);
  const isImage = attachment && attachment.type === "image";
  const isVideo = attachment && attachment.type === "video";
  const isAudio = attachment && attachment.type === "audio";
  const isFile = !!attachment && !isImage && !isVideo && !isAudio;
  const date = formatDate(item.created_at || item.createdAt);
  const meta = metaParts.join(" · ");
  return {
    id: item.id || item._id || "",
    title,
    detail,
    meta,
    date,
    metaLine: meta ? `${date} · ${meta}` : date,
    attachment,
    isImage,
    isVideo,
    isAudio,
    isFile
  };
}

Page({
  data: {
    themeOptions,
    theme: "warm",
    currentThemeLabel: "暖晨橙绿",
    fontSize: 100,
    contrast: false,
    items: [],
    filteredItems: [],
    keyword: "",
    emptyText: "本地没有保存的吐槽记录。",
    statusText: "",
    statusType: "info",
    loading: false,
    isAdmin: false,
    showAdminInput: false,
    adminKeyInput: "",
    reportAspect: "",
    reportText: "",
    reportHint: "点击“生成报告”，输入要查看的方面（如：场景、问题类型、影响、需求）。",
    canGenerateReport: false
  },

  onLoad() {
    this.restorePreferences();
    // Default to admin mode off on every load.
    this.applyAdminState(false);
    this.loadData("数据已加载。");
  },

  restorePreferences() {
    const savedTheme = wx.getStorageSync(THEME_KEY);
    const savedFont = wx.getStorageSync(FONT_SIZE_KEY);
    const savedContrast = wx.getStorageSync(CONTRAST_KEY);

    if (savedTheme) {
      const theme = themeOptions.find((item) => item.value === savedTheme) || themeOptions[0];
      this.setData({ theme: theme.value, currentThemeLabel: theme.label });
    }
    if (savedFont) {
      const fontSize = Number(savedFont);
      if (!Number.isNaN(fontSize)) this.setData({ fontSize });
    }
    if (typeof savedContrast === "boolean") {
      this.setData({ contrast: savedContrast });
    }
  },

  setStatus(message, type = "info") {
    this.setData({ statusText: message, statusType: type });
  },

  async verifyStoredKey() {
    const key = getApiKey();
    if (!key) {
      this.applyAdminState(false);
      return;
    }
    const result = await verifyAdminKey(key);
    if (!result.ok) {
      setApiKey("");
      this.applyAdminState(false);
      return;
    }
    this.applyAdminState(true);
  },

  applyAdminState(enabled) {
    this.setData({
      isAdmin: enabled,
      showAdminInput: false,
      adminKeyInput: enabled ? "" : this.data.adminKeyInput
    });
  },

  async loadData(message) {
    this.setData({ loading: true });
    const result = await fetchComplaints();
    if (!result.ok) {
      this.setData({
        loading: false
      });
      this.setStatus(result.error || "无法连接后端，暂时没有数据。", "warn");
      return;
    }
    const items = result.data.map((item) => {
      const normalized = normalizeItem(item);
      return {
        ...normalized,
        searchText: getSearchableText(item, normalized)
      };
    });
    this.setData({
      items,
      loading: false,
      canGenerateReport: items.length > 0
    });
    this.filterList(this.data.keyword);
    if (message) this.setStatus(message);
  },

  filterList(keyword) {
    const key = (keyword || "").trim().toLowerCase();
    const filteredItems = key
      ? this.data.items.filter((item) => (item.searchText || "").includes(key))
      : this.data.items;
    const emptyText = key ? "没有搜到相关吐槽。" : "本地没有保存的吐槽记录。";
    this.setData({ filteredItems, emptyText });
  },

  onSearchInput(e) {
    const keyword = e.detail.value;
    this.setData({ keyword });
    this.filterList(keyword);
  },

  onRefresh() {
    this.loadData("列表已刷新。");
  },

  onThemeChange(e) {
    const index = Number(e.detail.value);
    const theme = themeOptions[index] || themeOptions[0];
    wx.setStorageSync(THEME_KEY, theme.value);
    this.setData({ theme: theme.value, currentThemeLabel: theme.label });
  },

  onFontSizeChange(e) {
    const fontSize = Number(e.detail.value);
    wx.setStorageSync(FONT_SIZE_KEY, fontSize);
    this.setData({ fontSize });
  },

  onToggleContrast() {
    const contrast = !this.data.contrast;
    wx.setStorageSync(CONTRAST_KEY, contrast);
    this.setData({ contrast });
  },

  onAdminToggle() {
    if (this.data.isAdmin) {
      wx.showModal({
        title: "退出管理员模式",
        content: "确定退出管理员模式吗？",
        success: (res) => {
          if (!res.confirm) return;
          setApiKey("");
          this.applyAdminState(false);
          this.setStatus("管理员模式已关闭。");
          this.filterList(this.data.keyword);
        }
      });
      return;
    }
    const current = getApiKey() || "";
    this.setData({ showAdminInput: true, adminKeyInput: current });
  },

  onAdminKeyInput(e) {
    this.setData({ adminKeyInput: e.detail.value });
  },

  async onAdminVerify() {
    const trimmed = (this.data.adminKeyInput || "").trim();
    if (!trimmed) {
      this.setStatus("密钥不能为空。", "warn");
      return;
    }
    this.setStatus("正在验证密钥…");
    const result = await verifyAdminKey(trimmed);
    if (!result.ok) {
      this.setStatus(result.error || "密钥错误，无法进入管理员模式。", "warn");
      return;
    }
    setApiKey(trimmed);
    this.applyAdminState(true);
    this.setStatus("管理员模式已开启。");
    this.filterList(this.data.keyword);
  },

  onAdminCancel() {
    this.setData({ showAdminInput: false });
  },

  onReportAspectInput(e) {
    this.setData({ reportAspect: e.detail.value });
  },

  onGenerateReport() {
    const scopeList = filterByKeyword(this.data.items, this.data.keyword, (item) => item.searchText || "");
    if (!scopeList.length) {
      this.setStatus("当前没有可用的吐槽记录，无法生成报告。", "warn");
      return;
    }
    const trimmed = (this.data.reportAspect || "").trim();
    if (!trimmed) {
      this.setStatus("未输入方面，已取消生成。", "warn");
      return;
    }
    const reportText = buildReport(trimmed, scopeList, this.data.keyword);
    this.setData({
      reportText,
      reportHint: `已生成关于「${trimmed}」的报告。`
    });
    this.setStatus(`已基于“${trimmed}”生成报告。`);
  },

  onCopyReport() {
    if (!this.data.reportText) return;
    wx.setClipboardData({
      data: this.data.reportText,
      success: () => this.setStatus("报告已复制到剪贴板。"),
      fail: () => this.setStatus("报告复制失败。", "warn")
    });
  },

  onClearReport() {
    this.setData({
      reportText: "",
      reportHint: "点击“生成报告”，输入要查看的方面（如：场景、问题类型、影响、需求）。"
    });
  },

  onClearAll() {
    if (!this.data.isAdmin) {
      this.setStatus("需要管理员密钥才能清空。", "warn");
      return;
    }
    wx.showModal({
      title: "确认清空",
      content: "高能预警：这将清空后端的所有吐槽记录！确定吗？",
      success: async (res) => {
        if (!res.confirm) return;
        this.setStatus("正在清空…");
        const result = await clearComplaints();
        if (!result.ok) {
          if (result.error === "Unauthorized") {
            setApiKey("");
            this.applyAdminState(false);
            this.setStatus("管理员密钥无效，请重新进入管理员模式。", "warn");
            return;
          }
          this.setStatus(`清空失败：${result.error || "未知错误"}`, "warn");
          return;
        }
        this.loadData("所有记录已清空。");
      }
    });
  },

  onDeleteItem(e) {
    if (!this.data.isAdmin) {
      this.setStatus("需要管理员密钥才能删除。", "warn");
      return;
    }
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.showModal({
      title: "确认删除",
      content: "确认删除这条吐槽记录？",
      success: async (res) => {
        if (!res.confirm) return;
        this.setStatus("正在删除…");
        const result = await deleteComplaint(id);
        if (!result.ok) {
          if (result.error === "Unauthorized") {
            setApiKey("");
            this.applyAdminState(false);
            this.setStatus("管理员密钥无效，请重新进入管理员模式。", "warn");
            return;
          }
          this.setStatus(`删除失败：${result.error || "未知错误"}`, "warn");
          return;
        }
        this.loadData("已删除该条记录。");
      }
    });
  },

  onCopyItem(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.items.find((entry) => entry.id === id);
    if (!item) return;
    wx.setClipboardData({
      data: `${item.title}\n${item.detail || ""}`.trim(),
      success: () => this.setStatus("已复制到剪贴板。"),
      fail: () => this.setStatus("复制失败。", "warn")
    });
  },

  onPreviewAttachment(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.items.find((entry) => entry.id === id);
    if (!item || !item.attachment) return;
    if (item.isImage) {
      wx.previewImage({ urls: [item.attachment.data] });
      return;
    }
    this.setStatus("暂不支持预览该类型附件。", "warn");
  },

  goBack() {
    wx.navigateBack({
      delta: 1,
      fail: () => {
        wx.redirectTo({ url: "/pages/index/index" });
      }
    });
  }
});
