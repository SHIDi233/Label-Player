import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

const fluentFfmpeg = require('fluent-ffmpeg');
const ffprobeStatic = require('ffprobe-static')
function setupFFmpeg() {
  const fs = require('fs');
  if (ffprobeStatic.path) {
    fluentFfmpeg.setFfprobePath(ffprobeStatic.path)
    console.log('FFprobe PATH set success:', ffprobeStatic.path)
    
    // 验证文件是否存在
    if (fs.existsSync(ffprobeStatic.path)) {
      console.log('FFprobe file exists.')
    } else {
      console.warn('FFprobe file not exists.:', ffprobeStatic.path)
    }
  } else {
    console.error('Can\'t get ffprobe-static PATH.')
  }
}

// 底层API =======>
function api_open_json(event, url){
  return new Promise((resolve, reject) => {
    const fs = require('fs');
    fs.readFile(url,'utf8',function (err, data) {
      // 可以判断 err 对象是否为 nul，从而知晓文件读取的结果
      if (err) {
        console.error('读取文件时出现错误:', err);
        reject(err);
        return;
      }
        resolve(JSON.parse(data));
    });
  });
}

async function get_frame(event, frame_id) {
  const fluentFfmpeg = require('fluent-ffmpeg');
  return new Promise((resolve, reject) => {
      fluentFfmpeg.ffprobe(frame_id, (err, metadata) => {
          if (err) {
              reject(err);
              return;
          }
          resolve(metadata);
      });
  });
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
// 自定义协议
const path = require('node:path')
const { protocol} = require('electron')
app.whenReady().then(() => {
  protocol.registerFileProtocol('atom', (request, callback) => {
    let url = request.url.substr(7)
    const fixedPath = url.replace(/^([A-Za-z])\&/, '$1:');
    console.log("electronAppReady-------------------------============>atom url", fixedPath)
    console.log("electronAppReady-------------------------============>atom url", decodeURI(path.normalize(fixedPath)))
    callback(decodeURI(path.normalize(fixedPath)))
  })

  // 初始化ffmpeg
  setupFFmpeg();

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // API list
  ipcMain.handle('get_frame', get_frame); // 读取视频帧数
  ipcMain.handle('api_open_json', api_open_json); // 读取json

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
