/**
 * 混元AI API 服务
 * 使用轮询方式调用：创建任务 -> 轮询查询结果
 */

const AI_SECRET = 'bIezpEZXlEQae97gwZNVuH5Pvv16UVNl4bbesOvXFzmsLbVnUabxHLJi3HjnQtkrQyQfPPzqmeQVXwxCVX-6-kC5Lw4rzDjYU7hHCLcBENc';
const API_BASE = 'https://edu.weixin.qq.com';

// 系统提示词 - 帮助残障人士整理专业倾诉内容
const SYSTEM_PROMPT = `你是一位专业的无障碍倾诉助手，帮助听障和视障人士将他们的困扰整理成清晰、专业的倾诉内容。

## 你的角色
你是残障人士的朋友和代言人，用温暖、理解、耐心的态度倾听他们的困扰，帮助他们把口语化的表达整理成结构清晰、有理有据的正式倾诉。

## 对话策略
1. 首先要建立信任，让用户感到被理解和尊重
2. 通过开放式问题引导用户描述：
   - 发生了什么？（对象、场景）
   - 具体遇到了什么困难？（问题细节）
   - 这造成了什么影响？（后果）
   - 希望如何改进？（建议）
3. 每次只问1-2个问题，不要一次问太多
4. 对用户的内容进行共情和确认

## 信息收集要点
必须收集以下信息才能生成完整倾诉：
- 对象：吐槽的是什么服务/场所/产品（如：某地铁站、某医院、某App）。**对象必须具体明确**，不能只说是"手机""医院""App"这类笼统的词，要问清楚具体品牌/名称（如：苹果手机、协和医院、微信App）
- 场景：在什么情况下发生的（如：早高峰、挂号时、使用某功能时）
- 问题：具体的无障碍障碍是什么（如：没有字幕、标识不清、无法操作）
- 影响：造成了什么实际困扰（如：错过车次、延误就医、无法完成操作）
- 期望：希望对方如何改进（如：增加字幕提示、优化界面、提供辅助服务）

## 输出格式
当信息收集完整后（对象具体+问题清楚），输出格式如下：

【倾诉内容】
对象：[具体对象名称]
场景：[发生场景描述]
问题：[具体问题描述，包含细节]
影响：[造成的实际影响]
期望：[具体的改进建议]

## 对话示例
用户：我在地铁站遇到了问题
助手：谢谢你的分享。能具体说说是在哪个地铁站，遇到了什么问题吗？

用户：某某站，听不见广播
助手：明白了，在某某站听不到广播提示。这发生在什么情况下呢？比如是在等车的时候，还是在换乘时？

用户：等车的时候，不知道车到哪了
助手：了解了，等车的时候听不到广播，不知道列车进站信息，这确实很不方便。这个问题对你造成了什么影响吗？比如错过了车或者上错了车？

## 追问模糊的示例
用户：我的手机有问题
助手：了解，能具体告诉我是哪个品牌的手机吗？比如是苹果手机、华为手机，还是其他品牌？

用户：医院的服务太差了
助手：明白了，能告诉我是哪家医院吗？比如是协和医院、同仁医院，还是其他医院？这样反馈会更有效。

## 重要规则
- **对象必须具体**：如果用户只说"手机""医院""App"这类笼统的词，必须追问具体品牌/名称，不能生成【倾诉内容】
- 不要生成【倾诉内容】除非信息确实完整（对象具体+问题清楚）
- 每次回复控制在100字以内，简洁明了
- 使用口语化表达，像朋友聊天一样
- 对用户提到的困难表示理解和共情`;

// 初始欢迎语（仅用于界面显示，不发送给API）
const WELCOME_MESSAGE = '你好！我是你的无障碍倾诉助手。我在这里倾听你的困扰，帮你把想说的话整理得更清晰。你想聊聊最近遇到的什么问题吗？';

/**
 * 创建AI对话任务
 * @param {Array} messages - 对话历史 [{role, content}]
 * @returns {Promise<{taskId: string}|null>}
 */
function createTask(messages) {
  return new Promise((resolve) => {
    const queryId = 'wx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    console.log('创建AI任务，消息数:', messages.length);
    
    wx.request({
      url: `${API_BASE}/api/open/chat/create?ai_secret=${AI_SECRET}`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json'
      },
      data: {
        messages: messages,
        model: 'hunyuan-turbos-latest',
        query_id: queryId
      },
      success: (res) => {
        console.log('创建任务响应:', res.statusCode, res.data);
        
        if (res.statusCode === 200 && res.data?.data?.data?.task_id) {
          console.log('任务创建成功，ID:', res.data.data.data.task_id);
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
        console.log('轮询超时');
        resolve(null);
        return;
      }
      
      console.log(`轮询第${attempts}次...`);
      
      wx.request({
        url: `${API_BASE}/api/open/chat/task`,
        method: 'POST',
        header: {
          'Content-Type': 'application/json'
        },
        data: { 
          task_id: taskId,
          ai_secret: AI_SECRET
        },
        success: (res) => {
          console.log('轮询响应:', res.statusCode, res.data);
          
          if (res.statusCode !== 200) {
            setTimeout(poll, 2000);
            return;
          }
          
          // 处理嵌套的数据结构
          const responseData = res.data?.data;
          if (!responseData) {
            setTimeout(poll, 2000);
            return;
          }
          
          // 检查错误码
          if (responseData.ret !== 0) {
            console.error('API错误:', responseData.errmsg);
            setTimeout(poll, 2000);
            return;
          }
          
          const status = responseData.data?.status;
          console.log('任务状态:', status);
          
          if (status === 'completed') {
            // 解析返回的JSON字符串
            try {
              const contentStr = responseData.data?.content;
              if (!contentStr) {
                console.error('响应内容为空');
                resolve(null);
                return;
              }
              
              console.log('解析content字符串...');
              const result = JSON.parse(contentStr);
              
              if (result.error?.message) {
                console.error('AI返回错误:', result.error.message);
                resolve(null);
                return;
              }
              
              const aiReply = result.choices?.[0]?.message?.content;
              console.log('AI回复内容:', aiReply ? '成功获取' : '为空');
              resolve(aiReply || null);
            } catch (e) {
              console.error('解析AI响应失败:', e);
              // 如果解析失败，可能直接返回了文本
              resolve(responseData.data?.content || null);
            }
          } else if (status === 'processing') {
            // 继续轮询，每2秒一次
            setTimeout(poll, 2000);
          } else {
            // 其他状态，继续轮询
            setTimeout(poll, 2000);
          }
        },
        fail: (err) => {
          console.error('轮询请求失败:', err);
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
  // 确保消息格式正确 - 过滤掉空的和system消息后的第一条必须是user
  let validMessages = messages.filter(m => m.content && m.content.trim());
  
  // 确保消息符合API要求：system -> user -> assistant -> user ...
  // 如果最后一条是assistant的欢迎语，需要保留，但用户消息必须是user角色
  validMessages = validMessages.map((m, index) => {
    // 确保每条消息都有正确的字段
    return {
      role: m.role,
      content: m.content.trim()
    };
  });
  
  if (validMessages.length === 0) {
    console.error('没有有效的消息');
    return null;
  }
  
  // 检查消息顺序：第一条可以是system，然后必须user和assistant交替
  // 最后一条必须是user
  const lastMessage = validMessages[validMessages.length - 1];
  if (lastMessage.role !== 'user') {
    console.error('最后一条消息必须是user角色，当前是:', lastMessage.role);
    return null;
  }
  
  console.log('准备调用AI，有效消息数:', validMessages.length);
  console.log('消息角色顺序:', validMessages.map(m => m.role).join(' -> '));
  
  // 创建任务
  const taskResult = await createTask(validMessages);
  if (!taskResult) {
    console.error('创建任务失败');
    return null;
  }
  
  // 轮询获取结果
  const reply = await pollTaskResult(taskResult.taskId);
  return reply;
}

/**
 * 初始化对话消息（仅添加system prompt）
 * API要求：system后必须是user消息，不能有assistant消息
 * @returns {Array} 初始消息数组
 */
function initMessages() {
  return [
    { role: 'system', content: SYSTEM_PROMPT }
  ];
}

/**
 * 获取欢迎语（用于界面显示）
 * @returns {string} 欢迎语
 */
function getWelcomeMessage() {
  return WELCOME_MESSAGE;
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
  getWelcomeMessage,
  parseComplaint,
  buildSentence,
  SYSTEM_PROMPT
};
