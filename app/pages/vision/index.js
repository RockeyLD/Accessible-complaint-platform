const { chatWithAI, initMessages, parseComplaint, buildSentence } = require("../../utils/ai");
const { postComplaint } = require("../../utils/api");

const fontSizeOptions = [
  { value: 110, label: "大" },
  { value: 125, label: "特大" },
  { value: 150, label: "超大" }
];

Page({
  data: {
    // 主题设置
    fontSizeOptions,
    fontSize: 125,
    currentFontSizeLabel: "特大",
    highContrast: false,
    autoSpeak: true,
    
    // 页面状态
    showWelcome: true,
    
    // 对话状态
    messages: [],
    inputValue: "",
    isLoading: false,
    scrollToMessage: "",
    
    // AI对话历史
    aiMessages: [],
    
    // 语音输入
    isRecording: false,
    recorderManager: null,
    
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
    
    // 初始化录音管理器
    this.initRecorder();
  },

  onUnload() {
    // 停止录音
    if (this.data.recorderManager) {
      this.data.recorderManager.stop();
    }
  },

  // ========== 初始化录音 ==========
  initRecorder() {
    const recorderManager = wx.getRecorderManager();
    
    recorderManager.onStart(() => {
      this.setData({ isRecording: true });
      wx.vibrateShort({ type: 'light' });
    });
    
    recorderManager.onStop((res) => {
      this.setData({ isRecording: false });
      this.processVoiceInput(res.tempFilePath);
    });
    
    recorderManager.onError((err) => {
      console.error('录音错误:', err);
      this.setData({ isRecording: false });
      this.showStatus('录音失败，请重试', 'error');
    });
    
    this.setData({ recorderManager });
  },

  // ========== 主题设置 ==========
  onFontSizeChange(e) {
    const index = Number(e.detail.value);
    const option = fontSizeOptions[index] || fontSizeOptions[1];
    this.setData({
      fontSize: option.value,
      currentFontSizeLabel: option.label
    });
  },

  onToggleContrast() {
    this.setData({ highContrast: !this.data.highContrast });
  },

  onToggleAutoSpeak() {
    this.setData({ autoSpeak: !this.data.autoSpeak });
    this.showStatus(this.data.autoSpeak ? '已关闭自动朗读' : '已开启自动朗读', 'info');
  },

  // ========== 聊天控制 ==========
  startChat() {
    this.setData({ showWelcome: false });
    this.scrollToBottom();
    
    // 朗读欢迎语
    if (this.data.autoSpeak) {
      setTimeout(() => {
        this.speakText('你好！我是你的无障碍倾诉助手。按住下方麦克风按钮，告诉我你遇到了什么问题？');
      }, 500);
    }
  },

  resetChat() {
    wx.showModal({
      title: '重新开始',
      content: '确定要清空对话重新开始吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            messages: [],
            aiMessages: initMessages(),
            showConfirm: false,
            complaintData: {
              subject: '',
              scene: '',
              problem: '',
              impact: '',
              wish: '',
              isComplete: false
            },
            inputValue: ''
          });
          this.scrollToBottom();
          
          if (this.data.autoSpeak) {
            this.speakText('已重新开始，请告诉我你的困扰。');
          }
        }
      }
    });
  },

  goList() {
    wx.navigateTo({ url: '/pages/list/index' });
  },

  // ========== 语音输入 ==========
  startVoiceInput() {
    if (!this.data.recorderManager) return;
    
    this.data.recorderManager.start({
      duration: 60000,
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 48000,
      format: 'mp3'
    });
  },

  stopVoiceInput() {
    if (!this.data.recorderManager) return;
    
    this.data.recorderManager.stop();
  },

  onVoiceLongPress() {
    // 长按提示
    wx.vibrateLong();
    this.showStatus('按住说话，松开发送', 'info');
  },

  // 处理语音输入
  processVoiceInput(filePath) {
    // 使用微信同声传译插件或云开发进行语音识别
    // 这里使用微信内置的语音识别API
    wx.showLoading({ title: '识别中...' });
    
    wx.uploadFile({
      url: 'https://edu.weixin.qq.com/api/open/asr',
      filePath: filePath,
      name: 'file',
      formData: {
        ai_secret: 'bIezpEZXlEQae97gwZNVuH5Pvv16UVNl4bbesOvXFzmsLbVnUabxHLJi3HjnQtkrQyQfPPzqmeQVXwxCVX-6-kC5Lw4rzDjYU7hHCLcBENc'
      },
      success: (res) => {
        wx.hideLoading();
        try {
          const data = JSON.parse(res.data);
          if (data.text) {
            this.sendVoiceMessage(data.text);
          } else {
            this.showStatus('没听清，请再说一遍', 'error');
          }
        } catch (e) {
          // 如果API不可用，提示用户手动输入
          this.showStatus('语音识别暂时不可用，请使用文字输入', 'warn');
        }
      },
      fail: () => {
        wx.hideLoading();
        // 如果语音识别服务不可用，提示用户手动输入
        this.showStatus('请使用下方文字输入', 'warn');
      }
    });
  },

  // ========== 文字输入 ==========
  onInputChange(e) {
    this.setData({ inputValue: e.detail.value });
  },

  sendTextMessage() {
    const text = this.data.inputValue.trim();
    if (!text || this.data.isLoading) return;
    
    this.sendVoiceMessage(text);
    this.setData({ inputValue: '' });
  },

  // ========== 发送消息（通用） ==========
  sendVoiceMessage(text) {
    // 添加用户消息
    const userMessage = { role: 'user', content: text };
    const messages = [...this.data.messages, userMessage];
    const aiMessages = [...this.data.aiMessages, userMessage];

    this.setData({
      messages,
      aiMessages,
      isLoading: true,
      showConfirm: false
    });

    this.scrollToBottom();

    // 震动反馈
    wx.vibrateShort({ type: 'light' });

    // 调用AI
    this.callAI(aiMessages);
  },

  // ========== AI调用 ==========
  async callAI(aiMessages) {
    try {
      const reply = await chatWithAI(aiMessages);
      
      if (!reply) {
        const errorMessage = {
          role: 'assistant',
          content: '抱歉，我遇到了一点问题。请稍后再试，或者继续跟我聊聊。',
          isError: true
        };
        const messages = [...this.data.messages, errorMessage];
        const newAiMessages = [...this.data.aiMessages, errorMessage];
        
        this.setData({
          messages,
          aiMessages: newAiMessages,
          isLoading: false
        });
        
        if (this.data.autoSpeak) {
          this.speakText('抱歉，服务暂时不可用，请稍后再试。');
        }
        
        this.scrollToBottom();
        return;
      }

      // 解析AI回复
      const parsed = parseComplaint(reply);
      
      const aiMessage = {
        role: 'assistant',
        content: reply,
        parsed: parsed
      };
      
      const messages = [...this.data.messages, aiMessage];
      const newAiMessages = [...this.data.aiMessages, { role: 'assistant', content: reply }];

      this.setData({
        messages,
        aiMessages: newAiMessages,
        isLoading: false
      });

      // 自动朗读AI回复
      if (this.data.autoSpeak) {
        // 提取纯文本，移除格式标记
        const plainText = reply.replace(/【.*?】/g, '').replace(/对象[：:]/g, '对象').replace(/场景[：:]/g, '场景').replace(/问题[：:]/g, '问题').replace(/影响[：:]/g, '影响').replace(/期望[：:]/g, '期望');
        this.speakText(plainText);
      }

      // 如果AI回复包含完整的倾诉内容，显示确认卡片
      if (parsed && parsed.isComplete) {
        this.setData({
          showConfirm: true,
          complaintData: parsed
        });
        
        setTimeout(() => {
          this.setData({ scrollToMessage: 'confirm-card' });
        }, 100);
        
        // 震动提示
        wx.vibrateLong();
        
        if (this.data.autoSpeak) {
          setTimeout(() => {
            this.speakText('倾诉内容已整理完成。请确认是否提交，或者选择继续聊聊补充更多细节。');
          }, 2000);
        }
      }

      this.scrollToBottom();
    } catch (err) {
      console.error('AI调用错误:', err);
      const errorMessage = {
        role: 'assistant',
        content: '抱歉，服务暂时不可用。请稍后再试。',
        isError: true
      };
      const messages = [...this.data.messages, errorMessage];
      
      this.setData({
        messages,
        isLoading: false
      });
      
      if (this.data.autoSpeak) {
        this.speakText('抱歉，服务暂时不可用。');
      }
      
      this.scrollToBottom();
    }
  },

  // ========== 语音朗读 ==========
  speakMessage(e) {
    const index = e.currentTarget.dataset.index;
    const message = this.data.messages[index];
    if (message && message.content) {
      this.speakText(message.content);
    }
  },

  speakText(text) {
    // 微信小程序使用微信同声传译插件的TTS功能
    // 或者使用系统读屏功能
    
    // 方案1: 如果有同声传译插件
    try {
      const plugin = requirePlugin('WechatSI');
      plugin.textToSpeech({
        lang: 'zh_CN',
        tts: true,
        content: text,
        success: () => {
          console.log('语音播放成功');
        },
        fail: () => {
          // 使用震动反馈代替
          this.vibratePattern();
        }
      });
    } catch (e) {
      // 方案2: 使用震动反馈提示用户
      this.vibratePattern();
    }
  },

  vibratePattern() {
    // 短震动提示内容已更新
    wx.vibrateShort({ type: 'medium' });
  },

  // ========== 确认卡片操作 ==========
  continueChat() {
    this.setData({ showConfirm: false });
    this.scrollToBottom();
    
    if (this.data.autoSpeak) {
      this.speakText('好的，请继续告诉我更多信息。');
    }
  },

  async submitComplaint() {
    const data = this.data.complaintData;
    if (!data.isComplete) return;

    this.showStatus('正在提交...', 'info');
    
    if (this.data.autoSpeak) {
      this.speakText('正在提交，请稍候。');
    }

    const payload = {
      subject: data.subject,
      scene: data.scene,
      problem: data.problem,
      impact: data.impact,
      wish: data.wish,
      sentence: buildSentence(data),
      created_at: new Date().toISOString(),
      mode: 'vision',
      emotion: 3
    };

    const result = await postComplaint(payload);
    
    if (result.ok) {
      this.showStatus('提交成功！', 'success');
      
      if (this.data.autoSpeak) {
        this.speakText('提交成功！感谢你的分享。');
      }
      
      // 添加成功提示消息
      const successMessage = {
        role: 'assistant',
        content: '太好了！你的倾诉已经成功提交。感谢你分享这段经历，这有助于让更多人了解无障碍的重要性。还想聊聊其他问题吗？'
      };
      const messages = [...this.data.messages, successMessage];
      const aiMessages = [...this.data.aiMessages, { role: 'assistant', content: successMessage.content }];
      
      this.setData({
        messages,
        aiMessages,
        showConfirm: false,
        complaintData: {
          subject: '',
          scene: '',
          problem: '',
          impact: '',
          wish: '',
          isComplete: false
        }
      });
      
      this.scrollToBottom();
    } else {
      this.showStatus(`提交失败：${result.error || '请重试'}`, 'error');
      
      if (this.data.autoSpeak) {
        this.speakText('提交失败，请检查网络后重试。');
      }
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
      this.setData({ statusText: '' });
    }, 3000);
  }
});
