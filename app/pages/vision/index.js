const { postComplaint } = require("../../utils/api");

const questionMap = {
  summary: "一句话描述（必填）",
  detail: "详细描述（必填）",
  scene: "发生场景（可选）",
  severity: "影响程度（可选）",
  contact: "联系方式（可选）"
};

Page({
  data: {
    form: {
      summary: "",
      detail: "",
      scene: "",
      severity: "",
      contact: ""
    },
    promptText: "",
    activeHelpKey: "",
    quickAnswer: "",
    quickFocus: false,
    statusText: ""
  },

  onLoad() {
    this.updateHelp();
  },

  goList() {
    wx.navigateTo({ url: "/pages/list/index" });
  },

  setStatus(message) {
    this.setData({ statusText: message });
  },

  onQuickAnswerInput(e) {
    this.setData({ quickAnswer: e.detail.value });
  },

  onCommitAnswer() {
    this.commitHelpAnswer(this.data.quickAnswer);
    this.setData({ quickAnswer: "", quickFocus: false });
  },

  onStartVoice() {
    this.setData({ quickFocus: true });
    wx.showToast({ title: "请使用系统语音输入", icon: "none" });
  },

  getDetailPrompts(text) {
    const prompts = ["发生了什么？", "你尝试了哪些操作？", "哪里卡住了？"];
    if (/读屏|屏幕|看不见|朗读/.test(text)) {
      prompts.unshift("读屏具体读出了什么？哪些信息缺失？");
    }
    if (/按钮|表单|验证码|购票|支付/.test(text)) {
      prompts.unshift("具体卡在哪一步？");
    }
    return prompts.slice(0, 3);
  },

  formatStatePreview() {
    const lines = [];
    const { summary, detail, scene, severity, contact } = this.data.form;
    if (summary.trim()) lines.push(`已记录·一句话：${summary.trim()}`);
    if (detail.trim()) lines.push(`已记录·详细：${detail.trim()}`);
    if (scene.trim()) lines.push(`已记录·场景：${scene.trim()}`);
    if (severity.trim()) lines.push(`已记录·影响：${severity.trim()}`);
    if (contact.trim()) lines.push(`已记录·联系方式：${contact.trim()}`);
    return lines.join("\n");
  },

  updateHelp() {
    const requiredMissing = [];
    const optionalMissing = [];
    const { summary, detail, scene, severity, contact } = this.data.form;
    if (!summary.trim()) requiredMissing.push("summary");
    if (!detail.trim()) requiredMissing.push("detail");
    if (!scene.trim()) optionalMissing.push("scene");
    if (!severity.trim()) optionalMissing.push("severity");
    if (!contact.trim()) optionalMissing.push("contact");

    const queue = [...requiredMissing, ...optionalMissing];
    const activeHelpKey = queue[0] || "";
    let promptLine = questionMap[activeHelpKey] || "请补充信息";
    if (activeHelpKey === "detail") {
      const prompts = this.getDetailPrompts(detail.trim() || summary.trim());
      if (prompts.length) promptLine = prompts[0];
    }

    const preview = this.formatStatePreview();
    const promptText = [preview, activeHelpKey ? `请补充：${promptLine}` : "信息已完整，可以提交或继续补充细节。"]
      .filter(Boolean)
      .join("\n\n");
    this.setData({ activeHelpKey, promptText });
  },

  commitHelpAnswer(value) {
    const normalized = (value || "").trim();
    if (!normalized) return;
    const targetKey = this.data.activeHelpKey || (this.data.form.summary.trim() ? "detail" : "summary");
    const form = { ...this.data.form };
    if (targetKey === "summary") {
      form.summary = normalized;
    } else if (targetKey === "detail") {
      const current = form.detail.trim();
      form.detail = current ? `${current}；${normalized}` : normalized;
    } else if (targetKey === "scene") {
      form.scene = normalized;
    } else if (targetKey === "severity") {
      form.severity = normalized;
    } else if (targetKey === "contact") {
      form.contact = normalized;
    }
    this.setData({ form });
    this.updateHelp();
  },

  async onSubmit() {
    if (!this.data.form.summary.trim() || !this.data.form.detail.trim()) {
      this.updateHelp();
      this.setStatus("请先补全必填信息再提交。");
      return;
    }
    this.setStatus("正在提交到服务器…");
    const payload = {
      ...this.data.form,
      created_at: new Date().toISOString(),
      mode: "vision"
    };
    const result = await postComplaint(payload);
    if (!result.ok) {
      this.setStatus(`提交失败：${result.error || "未知错误"}`);
      return;
    }
    this.setData({
      form: { summary: "", detail: "", scene: "", severity: "", contact: "" },
      statusText: "提交成功，已保存到服务器。"
    });
    this.updateHelp();
  }
});
