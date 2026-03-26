export default defineAppConfig({
  pages: [
    'pages/login/index',
    'pages/privacy/index',
    'pages/onboard/index',
    'pages/home/index',
    'pages/camera/index',
    'pages/report/index',
    'pages/profile/index',
    'pages/assistant/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: '知食',
    navigationBarTextStyle: 'black',
  },
  lazyCodeLoading: 'requiredComponents',
  tabBar: {
    color: '#9CA3AF',
    selectedColor: '#10B981',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      { pagePath: 'pages/home/index',      text: '首页',   iconPath: 'assets/icons/home.png',      selectedIconPath: 'assets/icons/home-active.png' },
      { pagePath: 'pages/report/index',    text: '报告',   iconPath: 'assets/icons/report.png',    selectedIconPath: 'assets/icons/report-active.png' },
      { pagePath: 'pages/camera/index',    text: '记录',   iconPath: 'assets/icons/camera.png',    selectedIconPath: 'assets/icons/camera-active.png' },
      { pagePath: 'pages/profile/index',   text: '我的',   iconPath: 'assets/icons/profile.png',   selectedIconPath: 'assets/icons/profile-active.png' },
      { pagePath: 'pages/assistant/index', text: '助手',   iconPath: 'assets/icons/chat.png',      selectedIconPath: 'assets/icons/chat-active.png' },
    ],
  },
})
