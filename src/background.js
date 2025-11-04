'use strict'

import { app, BrowserWindow, ipcMain, dialog, Menu, protocol } from 'electron'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { createProtocol } from 'vue-cli-plugin-electron-builder/lib'

const isDevelopment = Boolean(process.env.WEBPACK_DEV_SERVER_URL)

const resolveConfigPath = () => path.join(app.getPath('userData'), 'settings.json')
let settings = {
  deeRoot: process.env.DEE_ROOT || process.env.DOLBY_BASE_PATH || process.env.DOLBY_ROOT || '',
  language: 'en',
}

const loadSettings = () => {
  try {
    const configFile = resolveConfigPath()
    if (fs.existsSync(configFile)) {
      const raw = fs.readFileSync(configFile, 'utf-8')
      const parsed = JSON.parse(raw)
      settings = { ...settings, ...parsed }
    }
    if (!settings.language || !['en', 'zh'].includes(settings.language)) {
      settings.language = 'en'
    }
  } catch (err) {
    console.warn('Failed to load settings:', err)
  }
}

const saveSettings = () => {
  try {
    const configFile = resolveConfigPath()
    fs.mkdirSync(path.dirname(configFile), { recursive: true })
    fs.writeFileSync(configFile, JSON.stringify(settings, null, 2), 'utf-8')
  } catch (err) {
    console.warn('Failed to save settings:', err)
  }
}

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { secure: true, standard: true } }])

const setLanguage = (newLang, { notifyRenderer = true } = {}) => {
  if (!['en', 'zh'].includes(newLang)) return false
  if (settings.language === newLang) return false
  settings.language = newLang
  saveSettings()
  if (mainWindow) {
    if (notifyRenderer) {
      mainWindow.webContents.send('set-language', newLang)
    }
    mainWindow.webContents.send('settings-updated', settings)
  }
  buildAppMenu()
  return true
}

const buildAppMenu = () => {
  try {
    const menuTemplate = [
      {
        label: 'Language',
        submenu: [
          {
            label: 'English',
            type: 'radio',
            accelerator: 'CmdOrCtrl+Shift+E',
            checked: settings.language === 'en',
            click: () => setLanguage('en'),
          },
          {
            label: '中文',
            type: 'radio',
            accelerator: 'CmdOrCtrl+Shift+C',
            checked: settings.language === 'zh',
            click: () => setLanguage('zh'),
          },
        ],
      },
      {
        label: 'About',
        submenu: [
          {
            label: 'About This App',
            click: () => {
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'About',
                message: `Dolby Encoding Engine\nVersion: ${app.getVersion()}`,
              })
            },
          },
        ],
      },
    ]

    const appMenu = Menu.buildFromTemplate(menuTemplate)
    Menu.setApplicationMenu(appMenu)
  } catch (err) {
    console.error('Failed to set application menu:', err)
  }
}

// 编译后的 C 程序路径：优先使用环境变量 ENCODE_PATH，其次在项目根查找 encode.exe
const C_PROGRAM_PATH = process.env.ENCODE_PATH || path.join(__dirname, '..', 'encode.exe')
// 状态文件默认放在项目根（若需要也可改为其他位置）
const STATE_FILE_PATH = path.join(__dirname, '..', 'last_params.txt')

let mainWindow

const PROGRESS_REGEX = /Overall progress:\s*([0-9]+(?:\.[0-9]+)?)/gi

const emitProgress = (text) => {
  if (!mainWindow) return
  if (typeof text !== 'string' || text.length === 0) return
  let match
  PROGRESS_REGEX.lastIndex = 0
  while ((match = PROGRESS_REGEX.exec(text)) !== null) {
    const value = parseFloat(match[1])
    if (!Number.isNaN(value)) {
      mainWindow.webContents.send('encoding-progress', value)
    }
  }
}

async function createWindow() {
  loadSettings()

  mainWindow = new BrowserWindow({
    width: 800,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
    },
  })

  if (isDevelopment) {
    await mainWindow.loadURL(process.env.WEBPACK_DEV_SERVER_URL)
    // 开发模式下默认不自动打开 DevTools
    if (process.env.OPEN_DEVTOOLS === 'true') {
      mainWindow.webContents.openDevTools()
    }
  } else {
    mainWindow.loadURL('app://./index.html')
  }

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('settings-updated', settings)
    if (settings.language) {
      mainWindow.webContents.send('set-language', settings.language)
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Build a minimal application menu with Language and About only
  buildAppMenu()
}

app.on('ready', async () => {
  if (!isDevelopment) {
    createProtocol('app')
  }
  await createWindow()
})

ipcMain.handle('choose-dee-root', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  })
  return result
})

ipcMain.handle('persist-language', async (event, requestedLang) => {
  const changed = setLanguage(requestedLang, { notifyRenderer: false })
  if (mainWindow && (changed || !['en', 'zh'].includes(settings.language))) {
    mainWindow.webContents.send('set-language', settings.language)
  } else if (mainWindow && !changed) {
    mainWindow.webContents.send('settings-updated', settings)
  }
  return settings.language
})

ipcMain.handle('update-settings', async (event, newSettings) => {
  settings = { ...settings, ...newSettings }
  saveSettings()
  if (mainWindow) {
    mainWindow.webContents.send('settings-updated', settings)
  }
  return settings
})

ipcMain.handle('get-settings', async () => settings)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

// IPC: 运行 C 程序
ipcMain.handle('run-c-program', async (event, args) => {
  console.log('Renderer requested to run C program with args:', args)
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(C_PROGRAM_PATH)) {
      console.error('C program not found:', C_PROGRAM_PATH)
      reject(new Error(`C 程序未找到: ${C_PROGRAM_PATH}`))
      return
    }
    console.log('C program path confirmed:', C_PROGRAM_PATH)
    console.log('Attempting to spawn C program...')
    const env = { ...process.env }
    if (settings && settings.deeRoot) {
      env.DEE_ROOT = settings.deeRoot
    }
    const cProcess = spawn(C_PROGRAM_PATH, args, { cwd: path.dirname(C_PROGRAM_PATH), env })

    cProcess.stdout.on('data', (data) => {
      const text = data.toString()
      console.log('C program stdout:', text.trim())
      mainWindow.webContents.send('console-output', text)
      emitProgress(text)
    })

    cProcess.stderr.on('data', (data) => {
      const text = data.toString()
      console.error('C program stderr:', text.trim())
      mainWindow.webContents.send('console-output', text)
      emitProgress(text)
    })

    cProcess.on('close', (code) => {
      console.log(`C program exited with code: ${code}`)
      if (code !== 0) {
        mainWindow.webContents.send('encoding-error', `C 程序退出码: ${code}`)
        reject(new Error(`C 程序退出码: ${code}`))
      } else {
        mainWindow.webContents.send('encoding-complete', code)
        resolve(code)
      }
    })

    cProcess.on('error', (err) => {
      console.error(`Failed to start C program process: ${err.message}`)
      mainWindow.webContents.send('encoding-error', `启动 C 程序失败: ${err.message}`)
      reject(err)
    })
  })
})

// IPC: 加载 C 程序保存的参数
ipcMain.handle('load-c-params', async () => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(STATE_FILE_PATH)) {
      resolve({ valid: false }) // 文件不存在，表示无有效记录
      return
    }
    fs.readFile(STATE_FILE_PATH, 'utf8', (err, data) => {
      if (err) {
        reject(err)
        return
      }
      const params = {
        choice: 0,
        start: '',
        end: '',
        prepend_silence: '',
        append_silence: '',
        template_xml: '',
        output_file: '',
        input_file: '',
        valid: false,
      }
      const lines = data.split('\n')
      lines.forEach(line => {
        const [key, value] = line.split('=')
        if (key && value) {
          if (key === 'choice') params.choice = parseInt(value)
          else if (key === 'valid') params.valid = (parseInt(value) === 1)
          else params[key] = value.trim()
        }
      })
      resolve(params)
    })
  })
})

// IPC: 打开文件对话框
ipcMain.handle('open-file-dialog', async (event, options) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, options)
  return { canceled, filePaths }
})

// IPC: 保存文件对话框
ipcMain.handle('save-file-dialog', async (event, options) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, options)
  return { canceled, filePath }
})

ipcMain.handle('check-file-exists', async (event, filePath) => {
  if (typeof filePath !== 'string' || filePath.length === 0) return false
  try {
    return fs.existsSync(filePath)
  } catch (err) {
    console.warn('check-file-exists error:', err)
    return false
  }
})

// IPC: 退出应用
ipcMain.on('quit-app', () => {
  app.quit()
})
