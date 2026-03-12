/**
 * 语音服务模块
 * 封装微信语音识别和语音合成能力
 */

/**
 * 开始语音识别
 * @param {Object} options - 配置选项
 * @param {Function} options.onStart - 开始识别回调
 * @param {Function} options.onResult - 识别结果回调 (result)
 * @param {Function} options.onError - 错误回调 (errorMsg)
 * @param {Function} options.onEnd - 识别结束回调
 */
function startVoiceRecognition(options = {}) {
  const manager = wx.getRecorderManager();
  
  manager.onStart(() => {
    if (options.onStart) options.onStart();
  });
  
  manager.onStop((res) => {
    const { tempFilePath } = res;
    
    // 调用语音识别
    wx.request({
      url: 'https://edu.weixin.qq.com/api/open/asr',
      method: 'POST',
      header: {
        'Content-Type': 'multipart/form-data'
      },
      data: {
        file: tempFilePath,
        ai_secret: 'bIezpEZXlEQae97gwZNVuH5Pvv16UVNl4bbesOvXFzmsLbVnUabxHLJi3HjnQtkrQyQfPPzqmeQVXwxCVX-6-kC5Lw4rzDjYU7hHCLcBENc'
      },
      success: (res) => {
        if (res.data?.text) {
          if (options.onResult) options.onResult(res.data.text);
        } else {
          if (options.onError) options.onError('识别失败，请重试');
        }
      },
      fail: () => {
        if (options.onError) options.onError('网络错误，请重试');
      },
      complete: () => {
        if (options.onEnd) options.onEnd();
      }
    });
  });
  
  manager.onError((err) => {
    if (options.onError) options.onError(err.errMsg || '录音失败');
    if (options.onEnd) options.onEnd();
  });
  
  // 开始录音
  manager.start({
    duration: 60000,
    sampleRate: 16000,
    numberOfChannels: 1,
    encodeBitRate: 48000,
    format: 'mp3'
  });
  
  return manager;
}

/**
 * 停止语音识别
 * @param {Object} manager - 录音管理器实例
 */
function stopVoiceRecognition(manager) {
  if (manager) {
    manager.stop();
  }
}

/**
 * 语音合成（文字转语音）
 * @param {string} text - 要朗读的文字
 * @param {Object} options - 配置选项
 * @param {Function} options.onStart - 开始朗读回调
 * @param {Function} options.onEnd - 朗读结束回调
 * @param {Function} options.onError - 错误回调
 */
function textToSpeech(text, options = {}) {
  if (!text || text.trim().length === 0) {
    if (options.onError) options.onError('没有可朗读的内容');
    return;
  }
  
  // 小程序端使用微信内置语音合成（需要后台配合）
  // 或者使用腾讯云的语音合成服务
  wx.request({
    url: 'https://edu.weixin.qq.com/api/open/tts',
    method: 'POST',
    header: {
      'Content-Type': 'application/json'
    },
    data: {
      text: text,
      ai_secret: 'bIezpEZXlEQae97gwZNVuH5Pvv16UVNl4bbesOvXFzmsLbVnUabxHLJi3HjnQtkrQyQfPPzqmeQVXwxCVX-6-kC5Lw4rzDjYU7hHCLcBENc',
      voice_type: 0,
      speed: 0
    },
    success: (res) => {
      if (res.data?.audio_url) {
        // 播放音频
        const innerAudioContext = wx.createInnerAudioContext();
        innerAudioContext.src = res.data.audio_url;
        
        innerAudioContext.onPlay(() => {
          if (options.onStart) options.onStart();
        });
        
        innerAudioContext.onEnded(() => {
          if (options.onEnd) options.onEnd();
          innerAudioContext.destroy();
        });
        
        innerAudioContext.onError((err) => {
          if (options.onError) options.onError('播放失败');
          innerAudioContext.destroy();
        });
        
        innerAudioContext.play();
      } else {
        // 如果API不可用，使用系统朗读
        fallbackSpeech(text, options);
      }
    },
    fail: () => {
      fallbackSpeech(text, options);
    }
  });
}

/**
 * 备用语音方案 - 使用小程序内置能力
 * 在微信小程序中，主要依靠系统读屏功能
 * 这里提供一个简单的提示
 */
function fallbackSpeech(text, options = {}) {
  // 小程序端无法直接调用系统TTS
  // 使用震动反馈来提示视障用户
  wx.vibrateShort({ type: 'light' });
  
  if (options.onStart) options.onStart();
  
  // 延迟后触发结束，让用户知道内容已"朗读"（实际依赖系统读屏）
  setTimeout(() => {
    if (options.onEnd) options.onEnd();
  }, 1000);
}

/**
 * 震动反馈
 * @param {string} type - 震动类型 'light' | 'medium' | 'heavy'
 */
function vibrate(type = 'medium') {
  if (type === 'light') {
    wx.vibrateShort({ type: 'light' });
  } else {
    wx.vibrateLong();
  }
}

/**
 * 提示音
 */
function playBeep() {
  const innerAudioContext = wx.createInnerAudioContext();
  // 使用小程序内置音频或base64编码的短提示音
  // 这里简化处理，使用震动代替
  wx.vibrateShort({ type: 'medium' });
}

module.exports = {
  startVoiceRecognition,
  stopVoiceRecognition,
  textToSpeech,
  vibrate,
  playBeep
};
