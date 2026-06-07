import type { Config } from '@tarojs/service'

const config: Config = {
  framework: 'react',
  projectName: 'mmx-music-studio',
  designWidth: 375,
  deviceRatio: {
    '640': 2.176 / 2,
    '750': 1,
    '828': 1.812 / 2,
    '375': 2,
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  plugins: [],
  compiler: 'webpack5',
  cacheBasePath: '.taro-cache',
  cssLoader: 'css-loader',
  miniCssLoader: 'mini-css-extract-plugin',
}

export default config