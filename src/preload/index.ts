import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('video_api', {
      // 打开文件
      openFileDialog: (options) => ipcRenderer.invoke('open-file-dialog', options),
      openDirectoryDialog: () => ipcRenderer.invoke('open-directory-dialog'),
      // 获取帧数
      get_frame: (frame_id) => ipcRenderer.invoke('get_frame', frame_id),
      // 底层API====>
      api_open_json: (url) => ipcRenderer.invoke('api_open_json', url),
      analysis_load_image: (url) => ipcRenderer.invoke('analysis_load_image', url),
    });
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
