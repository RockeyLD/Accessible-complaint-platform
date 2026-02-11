const { postComplaint } = require("../../utils/api");

const emotionMap = {
  1: "很平静",
  2: "轻微不满",
  3: "中等",
  4: "明显不满",
  5: "非常生气"
};

const questionMap = {
  subject: "你在吐槽哪个对象/服务/平台？",
  scene: "发生场景（地点/时间，如：医院窗口/早高峰）？",
  problem: "具体问题是什么？缺少了哪些文字或视觉提示？",
  impact: "造成了什么影响或不便？",
  wish: "你希望对方如何改进？"
};

const detailLabelMap = {
  impact: "影响了什么",
  wish: "期望的改进"
};

const themeOptions = [
  { value: "warm", label: "暖晨橙绿" },
  { value: "sea", label: "海风蓝绿" },
  { value: "sun", label: "日光米黄" },
  { value: "stone", label: "清爽灰白" }
];

const categoryNames = ["公共服务", "出行", "医疗", "教育", "线上平台", "工作场所"];

const visibilityOptions = ["匿名", "署名"];

Page({
  data: {
    themeOptions,
    theme: "warm",
    currentThemeLabel: "暖晨橙绿",
    contrast: false,
    fontSize: 100,
    categories: categoryNames.map((name) => ({ name, selected: false })),
    visibilityOptions,
    form: {
      subject: "",
      scene: "",
      problem: "",
      impact: "",
      wish: "",
      emotion: 3,
      visibility: "匿名"
    },
    emotionLabel: emotionMap[3],
    progressText: "0 / 2",
    progressPercent: 0,
    previewSentence: "填写后会生成一句话吐槽，方便直接提交。",
    statusText: "填写内容后会在这里生成清晰可读的吐槽卡片。",
    statusType: "info",
    canSubmit: false,
    missingVisible: false,
    missingTitle: "",
    missingQuestions: [],
    detailPromptsImpact: [],
    detailPromptsWish: [],
    detailLabelMap,
    detailAnswers: { impact: [], wish: [] },
    autoFillCache: { impact: "", wish: "" },
    manualOverride: { impact: false, wish: false },
    lastProblemSeed: ""
  },

  onLoad() {
    this.updateEmotionLabel();
    this.updateProgress();
  },

  goList() {
    wx.navigateTo({ url: "/pages/list/index" });
  },

  onThemeChange(e) {
    const index = Number(e.detail.value);
    const theme = themeOptions[index] || themeOptions[0];
    this.setData({
      theme: theme.value,
      currentThemeLabel: theme.label
    });
  },

  onFontSizeChange(e) {
    this.setData({ fontSize: Number(e.detail.value) });
  },

  onToggleContrast() {
    this.setData({ contrast: !this.data.contrast });
  },

  onToggleCategory(e) {
    const index = Number(e.currentTarget.dataset.index);
    const categories = this.data.categories.map((item, idx) => {
      if (idx !== index) return item;
      return { ...item, selected: !item.selected };
    });
    this.setData({ categories });
  },

  onInputField(e) {
    const key = e.currentTarget.dataset.field;
    const value = e.detail.value;
    if (key === "problem") {
      const trimmed = value.trim();
      if (trimmed !== this.data.lastProblemSeed) {
        this.setData({
          detailAnswers: { impact: [], wish: [] },
          autoFillCache: { impact: "", wish: "" },
          manualOverride: { impact: false, wish: false },
          lastProblemSeed: trimmed
        });
      }
    }
    this.updateFormField(key, value, false);
    this.updateProgress();
  },

  onMissingInput(e) {
    const key = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.updateFormField(key, value, false);
    this.updateProgress();
    this.renderPreview(this.collectData());
  },

  onDetailInput(e) {
    const key = e.currentTarget.dataset.key;
    const index = Number(e.currentTarget.dataset.index);
    const detailAnswers = { ...this.data.detailAnswers };
    const list = (detailAnswers[key] || []).slice();
    list[index] = e.detail.value;
    detailAnswers[key] = list;
    this.setData({ detailAnswers });
    this.applyAutoFill(key);
    this.renderPreview(this.collectData());
  },

  onEmotionChange(e) {
    const value = Number(e.detail.value);
    this.setData({ "form.emotion": value });
    this.updateEmotionLabel();
  },

  onVisibilityChange(e) {
    const index = Number(e.detail.value);
    const visibility = this.data.visibilityOptions[index] || this.data.visibilityOptions[0];
    this.setData({ "form.visibility": visibility });
  },

  updateFormField(key, value, fromAuto) {
    const form = { ...this.data.form, [key]: value };
    const manualOverride = { ...this.data.manualOverride };
    if (!fromAuto && (key === "impact" || key === "wish")) {
      manualOverride[key] = value.trim().length > 0;
    }
    if (fromAuto && !value) {
      manualOverride[key] = false;
    }
    this.setData({ form, manualOverride });
  },

  updateEmotionLabel() {
    const label = emotionMap[this.data.form.emotion] || "";
    this.setData({ emotionLabel: label });
  },

  updateProgress() {
    const filled = [this.data.form.subject.trim(), this.data.form.problem.trim()].filter(Boolean).length;
    const progressText = `${filled} / 2`;
    const progressPercent = Math.round((filled / 2) * 100);
    this.setData({ progressText, progressPercent });
  },

  collectData() {
    const categories = this.data.categories.filter((item) => item.selected).map((item) => item.name);
    return { ...this.data.form, categories };
  },

  buildSentence(data) {
    const parts = [];
    const subjectText = data.subject || "【待补充】";
    const problemText = data.problem || "【待补充】";
    const sceneText = data.scene ? data.scene.trim() : "";

    let intro = `我想吐槽${subjectText}`;
    if (sceneText) {
      if (!subjectText.includes(sceneText)) intro = `在${sceneText}，我想吐槽${subjectText}`;
    }

    parts.push(intro.trim());
    parts.push(`主要问题是${problemText}`);
    if (data.impact) parts.push(`导致${data.impact}`);
    if (data.wish) parts.push(`希望${data.wish}`);

    const meta = [];
    if (data.categories.length) meta.push(`类别：${data.categories.join("、")}`);
    meta.push(`情绪：${emotionMap[data.emotion]}`);
    meta.push(`公开方式：${data.visibility}`);
    if (meta.length) parts.push(`（${meta.join("，")}）`);

    return `${parts.join("，").replace(/，（/g, "（")}。`;
  },

  renderPreview(data) {
    this.setData({ previewSentence: this.buildSentence(data) });
  },

  getDetailPrompts(problemText) {
    const text = (problemText || "").trim();
    const impactPrompts = [
      "这个问题让你错过或延误了什么？",
      "它导致你无法完成哪些具体操作？"
    ];
    const wishPrompts = [
      "你希望增加哪些文字或视觉提示？",
      "希望提供哪些替代沟通方式？"
    ];
    if (/语音|叫号|播报|广播|喊/.test(text)) {
      wishPrompts.unshift("希望语音信息如何同步（字幕/短信/震动等）？");
    }
    if (/排队|窗口|柜台|现场|大厅|服务台/.test(text)) {
      impactPrompts.unshift("是否影响排队/办理时机？");
    }
    if (/没有提示|未提示|缺少提示|提示不足|看不见/.test(text)) {
      wishPrompts.unshift("希望哪些关键信息被文字化/可视化？");
    }
    return {
      impact: impactPrompts.slice(0, 3),
      wish: wishPrompts.slice(0, 3)
    };
  },

  buildAutoText(key) {
    return (this.data.detailAnswers[key] || []).map((value) => value.trim()).filter(Boolean).join("；");
  },

  applyAutoFill(key) {
    const manualOverride = this.data.manualOverride[key];
    const nextValue = this.buildAutoText(key);
    const current = (this.data.form[key] || "").trim();
    const last = this.data.autoFillCache[key];
    if (!nextValue) {
      if (!current || current === last) {
        this.updateFormField(key, "", true);
        this.setData({ autoFillCache: { ...this.data.autoFillCache, [key]: "" } });
      }
      return;
    }
    if (manualOverride) return;
    if (current && current !== last) return;
    this.updateFormField(key, nextValue, true);
    this.setData({ autoFillCache: { ...this.data.autoFillCache, [key]: nextValue } });
  },

  setStatus(message, type) {
    this.setData({ statusText: message, statusType: type });
  },

  renderMissing(requiredMissing, optionalMissing, problemText) {
    if (requiredMissing.length === 0 && optionalMissing.length === 0) {
      this.setData({
        missingVisible: false,
        missingTitle: "",
        missingQuestions: [],
        detailPromptsImpact: [],
        detailPromptsWish: []
      });
      return;
    }

    const missingTitle =
      requiredMissing.length > 0 ? "缺少关键信息，请回答以下问题：" : "可选补充，让吐槽更完整：";
    const needDetail =
      problemText && (optionalMissing.includes("impact") || optionalMissing.includes("wish"));
    const missingQuestions = [];
    requiredMissing.forEach((key) => missingQuestions.push({ key, label: questionMap[key], optional: false }));

    if (needDetail) {
      optionalMissing
        .filter((key) => key !== "impact" && key !== "wish")
        .forEach((key) => missingQuestions.push({ key, label: questionMap[key], optional: true }));
    } else {
      optionalMissing.forEach((key) => missingQuestions.push({ key, label: questionMap[key], optional: true }));
    }

    let detailPromptsImpact = [];
    let detailPromptsWish = [];
    let detailAnswers = { ...this.data.detailAnswers };
    if (needDetail) {
      const prompts = this.getDetailPrompts(problemText);
      if (optionalMissing.includes("impact")) {
        const impactAnswers = (detailAnswers.impact || []).slice(0, prompts.impact.length);
        while (impactAnswers.length < prompts.impact.length) impactAnswers.push("");
        detailAnswers = { ...detailAnswers, impact: impactAnswers };
        detailPromptsImpact = prompts.impact.map((prompt, index) => ({
          prompt,
          value: impactAnswers[index] || ""
        }));
      }
      if (optionalMissing.includes("wish")) {
        const wishAnswers = (detailAnswers.wish || []).slice(0, prompts.wish.length);
        while (wishAnswers.length < prompts.wish.length) wishAnswers.push("");
        detailAnswers = { ...detailAnswers, wish: wishAnswers };
        detailPromptsWish = prompts.wish.map((prompt, index) => ({
          prompt,
          value: wishAnswers[index] || ""
        }));
      }
      this.setData({ detailAnswers });
    }

    this.setData({
      missingVisible: true,
      missingTitle,
      missingQuestions,
      detailPromptsImpact,
      detailPromptsWish
    });

    if (needDetail) {
      if (optionalMissing.includes("impact")) this.applyAutoFill("impact");
      if (optionalMissing.includes("wish")) this.applyAutoFill("wish");
    }
  },

  buildCard() {
    const data = this.collectData();
    const requiredMissing = [];
    const optionalMissing = [];
    if (!data.subject) requiredMissing.push("subject");
    if (!data.problem) requiredMissing.push("problem");
    if (!data.scene) optionalMissing.push("scene");
    if (!data.impact) optionalMissing.push("impact");
    if (!data.wish) optionalMissing.push("wish");

    this.renderPreview(data);
    this.renderMissing(requiredMissing, optionalMissing, data.problem);
    this.updateProgress();

    if (requiredMissing.length > 0) {
      this.setStatus("还缺少关键内容，请先补全再生成一句话吐槽。", "warn");
      this.setData({ canSubmit: false });
      return;
    }

    this.setStatus("一句话吐槽已生成，可提交。", "info");
    this.setData({ canSubmit: true });
  },

  async onSave() {
    this.buildCard();
    if (!this.data.canSubmit) return;
    this.setStatus("正在提交到服务器…", "info");
    const data = this.collectData();
    const payload = {
      ...data,
      sentence: this.buildSentence(data),
      created_at: new Date().toISOString(),
      mode: "hearing"
    };
    const result = await postComplaint(payload);
    if (result.ok) {
      this.setStatus("提交成功，已保存到服务器。", "info");
      this.resetForm();
      return;
    }
    this.setStatus(`提交失败：${result.error || "未知错误"}`, "warn");
  },

  resetForm() {
    const categories = this.data.categories.map((item) => ({ ...item, selected: false }));
    this.setData({
      categories,
      form: {
        subject: "",
        scene: "",
        problem: "",
        impact: "",
        wish: "",
        emotion: 3,
        visibility: "匿名"
      },
      emotionLabel: emotionMap[3],
      progressText: "0 / 2",
      progressPercent: 0,
      previewSentence: "填写后会生成一句话吐槽，方便直接提交。",
      statusText: "内容已清空，可以重新填写。",
      statusType: "info",
      canSubmit: false,
      missingVisible: false,
      missingTitle: "",
      missingQuestions: [],
      detailPromptsImpact: [],
      detailPromptsWish: [],
      detailAnswers: { impact: [], wish: [] },
      autoFillCache: { impact: "", wish: "" },
      manualOverride: { impact: false, wish: false },
      lastProblemSeed: ""
    });
  }
});
