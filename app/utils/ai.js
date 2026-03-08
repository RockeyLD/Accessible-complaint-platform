/**
 * 混元AI API 服务
 * 使用轮询方式调用：创建任务 -> 轮询查询结果
 */

const AI_SECRET = 'bIezpEZXlEQae97gwZNVuH5Pvv16UVNl4bbesOvXFzmsLbVnUabxHLJi3HjnQtkrQyQfPPzqmeQVXwxCVX-6-kC5Lw4rzDjYU7hHCLcBENc';
const API_BASE = 'https://edu.weixin.qq.com';

// 系统提示词 - 帮助残障人士整理专业倾诉内容
const SYSTEM_PROMPT = `你是一位专业的无障碍倾诉助手，帮助听障和视障人士将他们的困扰整理成清晰、专业的倾诉内容。

你的任务：
1. 用温暖、耐心的语气与用户对话
2. 引导用户说出遇到的问题（对象、场景、具体问题、影响、期望改进）
3. 将用户的口语化表达整理成结构化的专业倾诉
4. 如果信息不完整，友好地询问缺失的部分

输出格式要求：
当信息收集完整后，输出格式如下：

【倾诉内容】
对象：[吐槽对象]
场景：[发生场景]
问题：[具体问题描述]
影响：[造成的影响]
期望：[期望的改进]

对话风格：
- 温暖、理解、耐心
- 不使用专业术语
- 鼓励用户表达
- 每轮对话简洁明了`;

/**
 * 创建AI对话任务
 * @param {Array} messages - 对话历史 [{role, content}]
 * @returns {Promise<{taskId: string}|null>}
 */
function createTask(messages) {
  return new Promise((resolve) => {
    const queryId = 'wx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    wx.request({
      url: `${API_BASE}/api/open/chat/create?ai_secret=${AI_SECRET}`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json'
      },
      data: {
        messages: messages,
        model: 'hunyuan-turbos-20250716',
        query_id: queryId
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data?.data?.data?.task_id) {
          resolve({ taskId: res.data.data.data.task_id });
        } else {
          console.error('创建任务失败:', res);
          resolve(null);
        }
      },
      fail: (err) => {
        console.error('创建任务请求失败:', err);
        resolve(null);
      }
    });
  });
}

/**
 * 轮询查询任务结果
 * @param {string} taskId - 任务ID
 * @param {number} maxAttempts - 最大轮询次数
 * @returns {Promise<string|null>} AI回复内容
 */
function pollTaskResult(taskId, maxAttempts = 30) {
  return new Promise((resolve) => {
    let attempts = 0;
    
    const poll = () => {
      attempts++;
      
      if (attempts > maxAttempts) {
        resolve(null);
        return;
      }
      
      wx.request({
        url: `${API_BASE}/api/open/chat/task`,
        method: 'POST',
        header: {
          'Content-Type': 'application/json'
        },
        data: { task_id: taskId },
        success: (res) => {
          if (res.statusCode !== 200) {
            setTimeout(poll, 2000);
            return;
          }
          
          const data = res.data?.data;
          if (!data) {
            setTimeout(poll, 2000);
            return;
          }
          
          const status = data.data?.status;
          
          if (status === 'completed') {
            // 解析返回的JSON字符串
            try {
              const contentStr = data.data?.content;
              if (!contentStr) {
                resolve(null);
                return;
              }
              
              const result = JSON.parse(contentStr);
              if (result.error?.message) {
                console.error('AI返回错误:', result.error.message);
                resolve(null);
                return;
              }
              
              const aiReply = result.choices?.[0]?.message?.content;
              resolve(aiReply || null);
            } catch (e) {
              console.error('解析AI响应失败:', e);
              resolve(null);
            }
          } else if (status === 'processing') {
            // 继续轮询，每2秒一次
            setTimeout(poll, 2000);
          } else {
            // 其他状态，继续轮询
            setTimeout(poll, 2000);
          }
        },
        fail: () => {
          setTimeout(poll, 2000);
        }
      });
    };
    
    poll();
  });
}

/**
 * 发送消息给AI并获取回复
 * @param {Array} messages - 完整对话历史（包含system prompt）
 * @returns {Promise<string|null>} AI回复内容
 */
async function chatWithAI(messages) {
  // 确保消息格式正确
  const validMessages = messages.filter(m => m.content && m.content.trim());
  
  if (validMessages.length === 0) {
    return null;
  }
  
  // 创建任务
  const taskResult = await createTask(validMessages);
  if (!taskResult) {
    return null;
  }
  
  // 轮询获取结果
  const reply = await pollTaskResult(taskResult.taskId);
  return reply;
}

/**
 * 初始化对话消息（添加system prompt）
 * @returns {Array} 初始消息数组
 */
function initMessages() {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'assistant', content: '你好！我是你的无障碍倾诉助手。我在这里倾听你的困扰，帮你把想说的话整理得更清晰。你想聊聊最近遇到的什么问题吗？' }
  ];
}

/**
 * 解析AI回复，检查是否包含完整的倾诉内容
 * @param {string} reply - AI回复
 * @returns {Object|null} 解析后的结构化数据
 */
function parseComplaint(reply) {
  if (!reply) return null;
  
  // 检查是否包含【倾诉内容】标记
  if (!reply.includes('【倾诉内容】')) {
    return null;
  }
  
  const result = {
    subject: '',
    scene: '',
    problem: '',
    impact: '',
    wish: '',
    isComplete: false
  };
  
  // 提取各字段
  const patterns = {
    subject: /对象[：:]\s*([^\n]+)/,
    scene: /场景[：:]\s*([^\n]+)/,
    problem: /问题[：:]\s*([^\n]+(?:\n(?![对象场景问题影响期望])[^\n]+)*)/,
    impact: /影响[：:]\s*([^\n]+(?:\n(?![对象场景问题影响期望])[^\n]+)*)/,
    wish: /期望[：:]\s*([^\n]+(?:\n(?![对象场景问题影响期望])[^\n]+)*)/
  };
  
  for (const [key, pattern] of Object.entries(patterns)) {
    const match = reply.match(pattern);
    if (match) {
      result[key] = match[1].trim();
    }
  }
  
  // 检查是否完整（至少包含对象和问题）
  result.isComplete = result.subject && result.problem;
  
  return result;
}

/**
 * 构建提交到服务器的句子
 * @param {Object} data - 倾诉数据
 * @returns {string} 格式化句子
 */
function buildSentence(data) {
  const parts = [];
  const subjectText = data.subject || '【待补充】';
  const problemText = data.problem || '【待补充】';
  const sceneText = data.scene || '';
  
  let intro = `我想吐槽${subjectText}`;
  if (sceneText && !subjectText.includes(sceneText)) {
    intro = `在${sceneText}，我想吐槽${subjectText}`;
  }
  
  parts.push(intro);
  parts.push(`主要问题是${problemText}`);
  
  if (data.impact) {
    parts.push(`导致${data.impact}`);
  }
  
  if (data.wish) {
    parts.push(`希望${data.wish}`);
  }
  
  return `${parts.join('，')}。`;
}

module.exports = {
  chatWithAI,
  initMessages,
  parseComplaint,
  buildSentence,
  SYSTEM_PROMPT
};
