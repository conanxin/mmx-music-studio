export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/studio/index',
    'pages/library/index',
    'pages/settings/index',
    'pages/docs/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#090A0C',
    navigationBarTitleText: 'MiniMax 音乐创作台',
    navigationBarTextStyle: 'white',
    backgroundColor: '#090A0C',
  },
  tabBar: {
    color: '#9BA1AA',
    selectedColor: '#B8FF6A',
    backgroundColor: '#121419',
    borderStyle: 'black',
    list: [
      { pagePath: 'pages/home/index', text: '首页', iconPath: 'assets/tab-home.png', selectedIconPath: 'assets/tab-home-active.png' },
      { pagePath: 'pages/studio/index', text: '创作', iconPath: 'assets/tab-studio.png', selectedIconPath: 'assets/tab-studio-active.png' },
      { pagePath: 'pages/library/index', text: '作品', iconPath: 'assets/tab-library.png', selectedIconPath: 'assets/tab-library-active.png' },
      { pagePath: 'pages/settings/index', text: '设置', iconPath: 'assets/tab-settings.png', selectedIconPath: 'assets/tab-settings-active.png' },
    ],
  },
})