const { chatWithAI, initMessages, getWelcomeMessage, parseComplaint, buildSentence } = require("../../utils/ai");
const { postComplaint } = require("../../utils/api");

const themeOptions = [
  { value: "blue", label: "默认" },
  { value: "warm", label: "暖橙" },
  { value: "green", label: "清新" }
];

const fontSizeOptions = [
  { value: 100, label: "标准" },
  { value: 125, label: "大" },
  { value: 150, label: "特大" }
];

Page({
  data: {
    // 输入模式: 'text' | 'voice'
    inputMode: 'text',
    
    // 主题设置
    themeOptions,
    theme: 'blue',
    currentThemeLabel: '默认',
    fontSizeOptions,
    fontSize: 100,
    currentFontSizeLabel: '标准',
    highContrast: false,
    largeFont: false,
    autoSpeak: true,
    
    // 对话
    messages: [],
    messageIdCounter: 0,
    aiMessages: [],
    isLoading: false,
    scrollToMessage: '',
    
    // 文字输入
    inputText: '',
    canSend: false,
    
    // 语音输入
    isRecording: false,
    recorderManager: null,
    
    // 确认卡片
    showConfirm: false,
    complaintData: null,
    
    // 状态
    statusText: '',
    statusType: 'info'
  },

  onLoad(options) {
    // 初始化AI消息（只有system prompt，符合API要求）
    const aiMessages = initMessages();
    
    // 初始化界面消息（包含欢迎语）
    const welcomeMessage = {
      id: 1,
      role: 'assistant',
      content: getWelcomeMessage()
    };
    
    // 根据传入参数设置输入模式
    const mode = options.mode || 'text';
    
    this.setData({
      inputMode: mode,
      messages: [welcomeMessage],
      messageIdCounter: 1,
      aiMessages,  // 只有system，不包含assistant欢迎语
      'fontSize': mode === 'voice' ? 125 : 100,
      'currentFontSizeLabel': mode === 'voice' ? '大' : '标准',
      'largeFont': mode === 'voice',
      'autoSpeak': mode === 'voice'
    });

    // 初始化录音管理器
    this.initRecorder();
  },

  onUnload() {
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
      this.handleVoiceResult(res.tempFilePath);
    });
    
    recorderManager.onError((err) => {
      console.error('录音错误:', err);
      this.setData({ isRecording: false });
      this.showStatus('录音失败，请重试或使用文字输入', 'error');
    });
    
    this.setData({ recorderManager });
  },

  // ========== 导航 ==========
  goBack() {
    wx.navigateBack();
  },

  goList() {
    wx.navigateTo({ url: '/pages/list/index' });
  },

  // ========== 设置切换 ==========
  toggleInputMode() {
    const newMode = this.data.inputMode === 'text' ? 'voice' : 'text';
    this.setData({ 
      inputMode: newMode,
      autoSpeak: newMode === 'voice'
    });
    this.showStatus(`已切换到${newMode === 'voice' ? '语音' : '文字'}输入`, 'info');
  },

  onThemeChange(e) {
    const index = parseInt(e.detail.value);
    const theme = themeOptions[index];
    this.setData({
      theme: theme.value,
      currentThemeLabel: theme.label
    });
  },

  onFontSizeChange(e) {
    const index = parseInt(e.detail.value);
    const option = fontSizeOptions[index];
    this.setData({
      fontSize: option.value,
      currentFontSizeLabel: option.label,
      largeFont: option.value >= 125
    });
  },

  onToggleContrast(e) {
    this.setData({ highContrast: e.detail.value });
  },

  onToggleAutoSpeak(e) {
    this.setData({ autoSpeak: e.detail.value });
  },

  // ========== 文字输入 ==========
  onTextInput(e) {
    const text = e.detail.value;
    this.setData({
      inputText: text,
      canSend: text.trim().length > 0 && !this.data.isLoading
    });
  },

  sendTextMessage() {
    const text = this.data.inputText.trim();
    if (!text || this.data.isLoading) return;

    this.sendMessage(text);
    this.setData({ inputText: '', canSend: false });
  },

  // ========== 语音输入 ==========
  startRecording() {
    if (!this.data.recorderManager) {
      this.showStatus('录音功能初始化失败', 'error');
      return;
    }
    
    // 检查录音权限
    wx.getSetting({
      success: (res) => {
        if (!res.authSetting['scope.record']) {
          wx.authorize({
            scope: 'scope.record',
            success: () => {
              this.doStartRecording();
            },
            fail: () => {
              wx.showModal({
                title: '需要录音权限',
                content: '请在设置中开启录音权限，或使用文字输入',
                showCancel: false
              });
            }
          });
        } else {
          this.doStartRecording();
        }
      }
    });
  },
  
  doStartRecording() {
    this.data.recorderManager.start({
      duration: 30000,  // 最长30秒
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 48000,
      format: 'mp3',
      frameSize: 50
    });
  },

  stopRecording() {
    if (!this.data.recorderManager) return;
    this.data.recorderManager.stop();
  },

  handleVoiceResult(filePath) {
    // 混元API没有ASR功能，使用小程序原生语音识别
    // 需要配置微信同声传译插件才能正常使用
    wx.hideLoading();
    
    // 删除录音文件，避免占用存储
    wx.getFileSystemManager().unlink({
      filePath: filePath,
      complete: () => {}
    });
    
    // 提示用户当前语音功能状态
    wx.showModal({
      title: '语音输入',
      content: '语音转文字功能需要额外配置。已为您切换到大字输入模式，可直接打字。',
      showCancel: false,
      confirmText: '好的',
      success: () => {
        this.setData({ inputMode: 'text' });
      }
    });
  },

  // ========== 核心：发送消息给AI ==========
  async sendMessage(text) {
    // 1. 添加用户消息到界面
    const userMsgId = this.data.messageIdCounter + 1;
    const userMessage = {
      id: userMsgId,
      role: 'user',
      content: text
    };
    const userAiMessage = { role: 'user', content: text };
    
    // 更新本地状态变量
    let currentMessages = [...this.data.messages, userMessage];
    let currentAiMessages = [...this.data.aiMessages, userAiMessage];
    
    this.setData({
      messages: currentMessages,
      aiMessages: currentAiMessages,
      messageIdCounter: userMsgId,
      isLoading: true,
      showConfirm: false,
      scrollToMessage: `msg-${userMsgId}`
    });

    // 2. 调用AI
    let reply = null;
    try {
      console.log('调用AI，消息数:', currentAiMessages.length);
      reply = await chatWithAI(currentAiMessages);
      console.log('AI回复:', reply ? '有回复' : '无回复');
    } catch (err) {
      console.error('AI调用异常:', err);
    }
    
    // 如果AI无响应，使用备用回复
    if (!reply) {
      console.log('AI无响应，使用备用回复');
      reply = this.generateFallbackReply(text, currentMessages);
    }

    // 3. 解析回复
    const parsed = parseComplaint(reply);
    const aiMsgId = userMsgId + 1;
    
    const aiMessage = {
      id: aiMsgId,
      role: 'assistant',
      content: reply,
      parsed: parsed
    };
    const aiMessageForHistory = { role: 'assistant', content: reply };
    
    currentMessages = [...currentMessages, aiMessage];
    currentAiMessages = [...currentAiMessages, aiMessageForHistory];
    
    this.setData({
      messages: currentMessages,
      aiMessages: currentAiMessages,
      messageIdCounter: aiMsgId,
      isLoading: false,
      scrollToMessage: `msg-${aiMsgId}`
    });

    // 4. 自动朗读（语音模式）
    if (this.data.autoSpeak && this.data.inputMode === 'voice') {
      // 清理格式标记后朗读
      const plainText = reply
        .replace(/【.*?】/g, '')
        .replace(/对象[：:]/g, '对象')
        .replace(/场景[：:]/g, '场景')
        .replace(/问题[：:]/g, '问题')
        .replace(/影响[：:]/g, '影响')
        .replace(/期望[：:]/g, '期望');
      this.speakText(plainText);
    }

    // 5. 如果信息完整，显示确认卡片
    if (parsed && parsed.isComplete) {
      this.setData({
        showConfirm: true,
        complaintData: parsed
      });
      
      setTimeout(() => {
        this.setData({ scrollToMessage: 'confirm-card' });
      }, 300);
      
      wx.vibrateShort({ type: 'heavy' });
      
      if (this.data.autoSpeak) {
        setTimeout(() => {
          this.speakText('倾诉内容已整理完成，请确认是否提交');
        }, 1000);
      }
    }
  },

  // ========== 备用回复生成（当AI API不可用时） ==========
  generateFallbackReply(userText, messages) {
    const text = userText.toLowerCase();
    const history = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
    
    // 提取关键信息
    const hasSubject = /银行|医院|地铁|公交|商场|超市|餐厅|车站|机场|客服|app|网站|电梯|厕所|门|路|街/.test(history);
    const hasScene = /早|晚|上班|下班|排队|买票|挂号|点餐|办事|出行|旅游/.test(history);
    const hasProblem = /听不见|看不到|没字幕|没提示|没标识|找不到|进不去|用不了|不理解/.test(history);
    const hasImpact = /错过|延误|等|急|难受|麻烦|困扰/.test(history);
    const hasWish = /希望|想要|建议|改进|优化/.test(history);
    
    // 生成回复
    let reply = '';
    
    if (!hasSubject) {
      reply = '谢谢你的分享。为了更好地帮你整理倾诉内容，能告诉我你想吐槽的是什么对象或服务吗？比如是某个地铁站、医院、还是App？';
    } else if (!hasProblem) {
      reply = '明白了。具体遇到了什么问题呢？是没有提供文字提示、还是其他无障碍方面的问题？';
    } else if (!hasScene) {
      reply = '了解了。这个问题是在什么场景下发生的？比如是早上高峰时段、还是在特定的场所？';
    } else if (!hasImpact) {
      reply = '这个问题给你带来什么影响了吗？比如耽误了时间、或者造成了不便？';
    } else if (!hasWish) {
      reply = '你希望对方怎么改进呢？比如增加字幕提示、或者提供更清晰的标识？';
    } else {
      // 信息基本完整，生成结构化内容
      const subject = this.extractInfo(history, /(银行|医院|地铁|公交|商场|超市|餐厅|车站|机场|客服|app|网站|电梯|厕所|门|路|街)[^，。]*/);
      const scene = this.extractInfo(history, /(早|晚|上班|下班|排队|买票|挂号|点餐|办事|出行|旅游)[^，。]*/);
      const problem = this.extractInfo(history, /(听不见|看不到|没字幕|没提示|没标识|找不到|进不去|用不了|不理解)[^，。]*/);
      const impact = this.extractInfo(history, /(错过|延误|等|急|难受|麻烦|困扰)[^，。]*/);
      const wish = this.extractInfo(history, /(希望|想要|建议)[^，。]*/);
      
      reply = `谢谢你的详细分享！我已经帮你整理好了倾诉内容：

【倾诉内容】
对象：${subject || '相关服务/场所'}
场景：${scene || '日常出行/使用过程中'}
问题：${problem || '无障碍设施不完善，缺乏必要的提示'}
影响：${impact || '造成使用不便'}
期望：${wish || '希望改进无障碍设施，提供更好的服务'}

如果你觉得还需要补充什么，可以继续告诉我。确认无误后可以点击提交按钮。`;
    }
    
    return reply;
  },

  extractInfo(text, pattern) {
    const match = text.match(pattern);
    return match ? match[0] : '';
  },

  // ========== 语音朗读 ==========
  speakText(text) {
    // 使用微信小程序同声传译插件
    try {
      const plugin = requirePlugin('WechatSI');
      plugin.textToSpeech({
        lang: 'zh_CN',
        tts: true,
        content: text,
        success: () => {},
        fail: () => {
          wx.vibrateShort({ type: 'medium' });
        }
      });
    } catch (e) {
      wx.vibrateShort({ type: 'medium' });
    }
  },

  // ========== 确认卡片操作 ==========
  continueChat() {
    this.setData({ showConfirm: false });
    this.scrollToBottom();
  },

  async submitComplaint() {
    const data = this.data.complaintData;
    if (!data || !data.isComplete) return;

    this.showStatus('正在提交...', 'info');

    const payload = {
      subject: data.subject,
      scene: data.scene,
      problem: data.problem,
      impact: data.impact,
      wish: data.wish,
      sentence: buildSentence(data),
      created_at: new Date().toISOString(),
      mode: this.data.inputMode,
      emotion: 3
    };

    const result = await postComplaint(payload);
    
    if (result.ok) {
      this.showStatus('✓ 提交成功！', 'success');
      
      // 添加成功消息
      const successId = this.data.messageIdCounter + 1;
      const successMessage = {
        id: successId,
        role: 'assistant',
        content: '太好了！你的倾诉已经成功提交。感谢你的分享，这会让更多人关注到无障碍的重要性。还想聊聊其他问题吗？'
      };
      
      this.setData({
        messages: [...this.data.messages, successMessage],
        aiMessages: [...this.data.aiMessages, { role: 'assistant', content: successMessage.content }],
        messageIdCounter: successId,
        showConfirm: false,
        complaintData: null,
        scrollToMessage: `msg-${successId}`
      });
      
      if (this.data.autoSpeak) {
        this.speakText('提交成功！感谢你的分享。');
      }
    } else {
      this.showStatus(`提交失败：${result.error || '请重试'}`, 'error');
    }
  },

  // ========== 重新开始 ==========
  resetChat() {
    wx.showModal({
      title: '重新开始',
      content: '确定要清空对话重新开始吗？',
      success: (res) => {
        if (res.confirm) {
          const welcomeMessage = {
            id: 1,
            role: 'assistant',
            content: getWelcomeMessage()
          };
          
          this.setData({
            messages: [welcomeMessage],
            aiMessages: initMessages(),
            messageIdCounter: 1,
            showConfirm: false,
            complaintData: null,
            inputText: '',
            canSend: false
          });
          
          if (this.data.autoSpeak) {
            this.speakText('已重新开始');
          }
        }
      }
    });
  },

  scrollToBottom() {
    const len = this.data.messages.length;
    if (len > 0) {
      this.setData({ scrollToMessage: `msg-${this.data.messageIdCounter}` });
    }
  },

  showStatus(text, type) {
    this.setData({ statusText: text, statusType: type });
    setTimeout(() => {
      this.setData({ statusText: '' });
    }, 3000);
  }
});
