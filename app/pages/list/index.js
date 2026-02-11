const { fetchComplaints, deleteComplaint, clearComplaints } = require("../../utils/api");

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (num) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function getSearchableText(item) {
  return [
    item.subject,
    item.problem,
    item.impact,
    item.wish,
    item.scene,
    item.summary,
    item.detail,
    item.contact,
    item.sentence,
    item.mode,
    (item.categories || []).join(" ")
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

Page({
  data: {
    items: [],
    filteredItems: [],
    keyword: "",
    statusText: "",
    loading: false
  },

  onLoad() {
    this.loadData("数据已加载。");
  },

  async loadData(message) {
    this.setData({ loading: true });
    const result = await fetchComplaints();
    if (!result.ok) {
      this.setData({
        loading: false,
        statusText: result.error || "无法连接后端，暂时没有数据。"
      });
      return;
    }
    const items = result.data.map((item) => ({
      ...item,
      displayTime: formatDate(item.created_at),
      title: item.sentence || item.summary || item.subject || "吐槽记录",
      modeLabel: item.mode === "vision" ? "视障模式" : item.mode === "hearing" ? "听障模式" : "未标注",
      categoriesText: Array.isArray(item.categories) ? item.categories.join("、") : ""
    }));
    this.setData({ items, loading: false, statusText: message || "" });
    this.filterList(this.data.keyword);
  },

  filterList(keyword) {
    const key = (keyword || "").trim().toLowerCase();
    const filteredItems = key
      ? this.data.items.filter((item) => getSearchableText(item).includes(key))
      : this.data.items;
    this.setData({ filteredItems });
  },

  onSearchInput(e) {
    const keyword = e.detail.value;
    this.setData({ keyword });
    this.filterList(keyword);
  },

  onRefresh() {
    this.loadData("列表已刷新。");
  },

  onClearAll() {
    wx.showModal({
      title: "确认清空",
      content: "确认清空所有吐槽记录？此操作无法撤回。",
      success: async (res) => {
        if (!res.confirm) return;
        const result = await clearComplaints();
        if (!result.ok) {
          this.setData({ statusText: result.error || "清空失败。" });
          return;
        }
        this.loadData("所有记录已清空。");
      }
    });
  },

  onDeleteItem(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.showModal({
      title: "确认删除",
      content: "确认删除这条吐槽记录？",
      success: async (res) => {
        if (!res.confirm) return;
        const result = await deleteComplaint(id);
        if (!result.ok) {
          this.setData({ statusText: result.error || "删除失败。" });
          return;
        }
        this.loadData("已删除该条记录。");
      }
    });
  }
});
