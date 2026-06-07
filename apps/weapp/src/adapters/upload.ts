// upload.ts — File upload adapter for WeChat Mini Program
// Phase 3A: TODO — file upload not implemented
// Phase 3C+: use wx.chooseMessageFile / wx.chooseMedia

// TODO: Implement audio file selection
// Phase 3C+ will use:
//   wx.chooseMessageFile({ type: 'audio', count: 1 })
//   wx.chooseMedia({ mediaType: 'video', sourceType: ['album', 'camera'] })

export interface UploadResult {
  tempFilePath: string
  size: number
  name: string
}

// Phase 3A: Not implemented
export const chooseAudioFile = async (): Promise<UploadResult | null> => {
  console.warn('[upload] Phase 3A: chooseAudioFile not implemented')
  return null
}

// TODO Phase 3C+:
// export const chooseAudioFile = async (): Promise<UploadResult | null> => {
//   return new Promise((resolve) => {
//     wx.chooseMessageFile({
//       type: 'audio',
//       count: 1,
//       success: (res) => {
//         const file = res.tempFiles[0]
//         resolve({
//           tempFilePath: file.path,
//           size: file.size,
//           name: file.name,
//         })
//       },
//       fail: () => resolve(null),
//     })
//   })
// }