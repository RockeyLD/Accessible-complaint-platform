const { chatWithAI, initMessages, parseComplaint, buildSentence } = require("../../utils/ai");
const { postComplaint } = require("../../utils/api");

const themeOptions = [
  { value: "warm", label: "暖橙" },
  { value: "sea", label: "蓝绿" },
  { value: "sun", label: "米黄" },
  { value: "stone", label: "灰白" }
];

const fontSizeOptions = [
  { value: 90, label: "小" },
  { value: 100, label: "中" },
  { value: 110, label: "大" },
  { value: 120, label: "特大" }
];

Page({
  data: {
    // 主题设置
    themeOptions,
    theme: "warm",
    currentThemeLabel: "暖橙",
    contrast: false,
    fontSizeOptions,
    fontSize: 100,
    currentFontSizeLabel: "中",
    
    // 页面状态
    showWelcome: true,
    
    // 对话状态
    messages: [],
    inputValue: "",
    inputPlaceholder: "说说你遇到的问题...",
    isLoading: false,
    scrollToMessage: "",
    
    // AI对话历史（包含system prompt）
    aiMessages: [],
    
    // 确认卡片
    showConfirm: false,
    complaintData: {
      subject: "",
      scene: "",
      problem: "",
      impact: "",
      wish: "",
      isComplete: false
    },
    
    // 状态提示
    statusText: "",
    statusType: "info"
  },

  onLoad() {
    this.setData({
      aiMessages: initMessages()
    });
  },

  // ========== 主题设置 ==========
  onThemeChange(e) {
    const index = Number(e.detail.value);
    const theme = themeOptions[index] || themeOptions[0];
    this.setData({
      theme: theme.value,
      currentThemeLabel: theme.label
    });
  },

  onFontSizeChange(e) {
    const index = Number(e.detail.value);
    const option = fontSizeOptions[index] || fontSizeOptions[1];
    this.setData({
      fontSize: option.value,
      currentFontSizeLabel: option.label
    });
  },

  onToggleContrast() {
    this.setData({ contrast: !this.data.contrast });
  },

  // ========== 聊天控制 ==========
  startChat() {
    this.setData({ showWelcome: false });
    this.scrollToBottom();
  },

  resetChat() {
    wx.showModal({
      title: "重新开始",
      content: "确定要清空对话重新开始吗？",
      success: (res) => {
        if (res.confirm) {
          this.setData({
            messages: [],
            aiMessages: initMessages(),
            showConfirm: false,
            complaintData: {
              subject: "",
              scene: "",
              problem: "",
              impact: "",
              wish: "",
              isComplete: false
            },
            inputValue: ""
          });
          this.scrollToBottom();
        }
      }
    });
  },

  goList() {
    wx.navigateTo({ url: "/pages/list/index" });
  },

  // ========== 输入处理 ==========
  onInputChange(e) {
    this.setData({ inputValue: e.detail.value });
  },

  sendMessage() {
    const text = this.data.inputValue.trim();
    if (!text || this.data.isLoading) return;

    // 添加用户消息
    const userMessage = { role: "user", content: text };
    const messages = [...this.data.messages, userMessage];
    const aiMessages = [...this.data.aiMessages, userMessage];

    this.setData({
      messages,
      aiMessages,
      inputValue: "",
      isLoading: true,
      showConfirm: false
    });

    this.scrollToBottom();

    // 调用AI
    this.callAI(aiMessages);
  },

  // ========== AI调用 ==========
  async callAI(aiMessages) {
    try {
      const reply = await chatWithAI(aiMessages);
      
      if (!reply) {
        // AI调用失败
        const errorMessage = {
          role: "assistant",
          content: "抱歉，我遇到了一点问题。请稍后再试，或者继续跟我聊聊。",
          isError: true
        };
        const messages = [...this.data.messages, errorMessage];
        const newAiMessages = [...this.data.aiMessages, errorMessage];
        
        this.setData({
          messages,
          aiMessages: newAiMessages,
          isLoading: false
        });
        this.scrollToBottom();
        return;
      }

      // 解析AI回复，检查是否包含完整倾诉内容
      const parsed = parseComplaint(reply);
      
      const aiMessage = {
        role: "assistant",
        content: reply,
        parsed: parsed
      };
      
      const messages = [...this.data.messages, aiMessage];
      const newAiMessages = [...this.data.aiMessages, { role: "assistant", content: reply }];

      this.setData({
        messages,
        aiMessages: newAiMessages,
        isLoading: false
      });

      // 如果AI回复包含完整的倾诉内容，显示确认卡片
      if (parsed && parsed.isComplete) {
        this.setData({
          showConfirm: true,
          complaintData: parsed
        });
        // 滚动到确认卡片
        setTimeout(() => {
          this.setData({ scrollToMessage: "confirm-card" });
        }, 100);
      }

      this.scrollToBottom();
    } catch (err) {
      console.error("AI调用错误:", err);
      const errorMessage = {
        role: "assistant",
        content: "抱歉，服务暂时不可用。请稍后再试。",
        isError: true
      };
      const messages = [...this.data.messages, errorMessage];
      
      this.setData({
        messages,
        isLoading: false
      });
      this.scrollToBottom();
    }
  },

  // ========== 确认卡片操作 ==========
  continueChat() {
    this.setData({ showConfirm: false });
    this.scrollToBottom();
  },

  async submitComplaint() {
    const data = this.data.complaintData;
    if (!data.isComplete) return;

    this.showStatus("正在提交...", "info");

    const payload = {
      subject: data.subject,
      scene: data.scene,
      problem: data.problem,
      impact: data.impact,
      wish: data.wish,
      sentence: buildSentence(data),
      created_at: new Date().toISOString(),
      mode: "hearing",
      emotion: 3
    };

    const result = await postComplaint(payload);
    
    if (result.ok) {
      this.showStatus("✓ 提交成功！", "success");
      
      // 添加成功提示消息
      const successMessage = {
        role: "assistant",
        content: "太好了！你的倾诉已经成功提交。感谢你分享这段经历，这有助于让更多人了解无障碍的重要性。还想聊聊其他问题吗？"
      };
      const messages = [...this.data.messages, successMessage];
      const aiMessages = [...this.data.aiMessages, { role: "assistant", content: successMessage.content }];
      
      this.setData({
        messages,
        aiMessages,
        showConfirm: false,
        complaintData: {
          subject: "",
          scene: "",
          problem: "",
          impact: "",
          wish: "",
          isComplete: false
        }
      });
      
      this.scrollToBottom();
    } else {
      this.showStatus(`提交失败：${result.error || "请重试"}`, "error");
    }
  },

  // ========== 辅助方法 ==========
  scrollToBottom() {
    const len = this.data.messages.length;
    if (len > 0) {
      this.setData({ scrollToMessage: `msg-${len - 1}` });
    }
  },

  showStatus(text, type) {
    this.setData({ statusText: text, statusType: type });
    setTimeout(() => {
      this.setData({ statusText: "" });
    }, 3000);
  }
});
