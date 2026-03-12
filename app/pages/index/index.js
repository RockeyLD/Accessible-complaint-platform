Page({
  startWithText() {
    wx.navigateTo({
      url: '/pages/chat/index?mode=text'
    });
  },

  startWithVoice() {
    wx.navigateTo({
      url: '/pages/chat/index?mode=voice'
    });
  }
});
