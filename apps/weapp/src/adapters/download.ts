// download.ts — File download adapter for WeChat Mini Program
// Phase 3A: mock implementation
// Phase 3C+: use wx.downloadFile + wx.saveFileToAlbum

// Phase 3A: Not implemented
export interface DownloadResult {
  savedFilePath: string
  tempFilePath: string
}

// TODO Phase 3C+: Implement real download
// export const downloadAndSaveAudio = async (
//   url: string,
//   filename: string
// ): Promise<DownloadResult | null> => {
//   return new Promise((resolve) => {
//     const downloadTask = wx.downloadFile({
//       url,
//       filePath: wx.env.USER_DATA_PATH + '/' + filename,
//       success: (res) => {
//         if (res.statusCode === 200) {
//           wx.saveFileToAlbum({
//             filePath: res.filePath,
//             success: () => {
//               resolve({ savedFilePath: res.filePath, tempFilePath: res.filePath })
//             },
//             fail: () => resolve(null),
//           })
//         } else {
//           resolve(null)
//         }
//       },
//       fail: () => resolve(null),
//     })
//   })
// }

export const downloadAndSaveAudio = async (
  _url: string,
  _filename: string
): Promise<DownloadResult | null> => {
  console.warn('[download] Phase 3A: downloadAndSaveAudio not implemented')
  return null
}