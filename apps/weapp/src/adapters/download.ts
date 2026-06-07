// download.ts — Audio download and save adapter for WeChat Mini Program
// Phase 3C: wx.downloadFile + wx.saveFile implementation
// Platform: WeChat Mini Program (Taro weapp)

// @ts-ignore Taro types have internal esModuleInterop issues
import Taro from '@tarojs/taro';

export interface DownloadResult {
  ok: boolean
  savedFilePath?: string
  tempFilePath?: string
  message: string
}

/**
 * Download audio file from server and save to device storage.
 * Phase 3C uses Taro API wrapper over wx.downloadFile / wx.saveFile.
 *
 * NOTE: This is a Phase 3C mock implementation. In a real mini program,
 * the audio URL should be a valid HTTPS URL to pass WeChat's domain whitelist check.
 * During development, WeChat DevTools can disable domain validation.
 */
export async function downloadAndSaveAudio(options: {
  url: string
  title?: string
}): Promise<DownloadResult> {
  const { url, title = 'music' } = options

  if (!url) {
    return { ok: false, message: '下载链接无效' }
  }

  return new Promise((resolve) => {
    // Taro.downloadFile is a Promise wrapper over wx.downloadFile
    Taro.downloadFile({ url })
      .then((downloadRes: { tempFilePath?: string; statusCode?: number }) => {
        if (!downloadRes.tempFilePath) {
          resolve({ ok: false, message: '下载失败' })
          return
        }
        const { tempFilePath, statusCode } = downloadRes

        if (statusCode !== 200) {
          resolve({ ok: false, message: `下载失败 (${statusCode})` })
          return
        }

        // Try to save to permanent storage
        const fileName = `${title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}_${Date.now()}.mp3`
        // @ts-ignore Taro callback result typing mismatch
        Taro.saveFile({ tempFilePath })
          .then((saveRes) => {
            // @ts-ignore savedFilePath exists on SuccessCallbackResult
            if (saveRes.savedFilePath) {
              resolve({
                ok: true,
                // @ts-ignore
                savedFilePath: saveRes.savedFilePath,
                tempFilePath,
                message: '保存成功',
              })
            } else {
              // Fallback: provide temp path with guidance
              resolve({
                ok: true,
                tempFilePath,
                message: '已下载到临时文件，请在文件管理中保存',
              })
            }
          })
          .catch(() => {
            // saveFile may fail in some environments — provide temp path
            resolve({
              ok: true,
              tempFilePath,
              message: '已下载到临时文件，请在文件管理中保存',
            })
          })
      })
      .catch(() => {
        resolve({ ok: false, message: '网络连接失败' })
      })
  })
}
