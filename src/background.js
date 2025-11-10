'use strict'

import { app, BrowserWindow, ipcMain, dialog, Menu, protocol, shell } from 'electron'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { createProtocol } from 'vue-cli-plugin-electron-builder/lib'

const isDevelopment = Boolean(process.env.WEBPACK_DEV_SERVER_URL)

const getAssetPath = (...segments) => {
  if (isDevelopment) {
    return path.join(process.cwd(), ...segments)
  }
  return path.join(process.resourcesPath, ...segments)
}

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
                message: 'Dolby Encoder GUI',
                detail: `Version: ${app.getVersion()}\nGitHub: https://github.com/chyinan/dolby-encoder-gui`,
                buttons: ['Open GitHub', 'OK'],
                defaultId: 1,
                cancelId: 1,
                noLink: true,
              }).then((result) => {
                if (result.response === 0) {
                  shell.openExternal('https://github.com/chyinan/dolby-encoder-gui').catch((err) => {
                    console.warn('Failed to open GitHub link:', err)
                  })
                }
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

const TEMP_ADM_FILENAME = 'ADM.wav'

const prepareTemporaryAdmRename = (inputPath) => {
  if (typeof inputPath !== 'string' || inputPath.length === 0) {
    return null
  }

  if (!fs.existsSync(inputPath)) {
    throw new Error(`输入文件不存在: ${inputPath}`)
  }

  const extension = path.extname(inputPath).toLowerCase()
  if (extension !== '.wav') {
    return null
  }

  const baseName = path.basename(inputPath)
  if (baseName.toLowerCase() === TEMP_ADM_FILENAME.toLowerCase()) {
    return null
  }

  const directory = path.dirname(inputPath)
  const tempPath = path.join(directory, TEMP_ADM_FILENAME)
  let backupPath = null
  let restored = false

  try {
    if (fs.existsSync(tempPath)) {
      const uniqueSuffix = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`
      backupPath = path.join(directory, `ADM__backup_${uniqueSuffix}.wav`)
      fs.renameSync(tempPath, backupPath)
      console.log(`[TEMP ADM] Existing ADM.wav moved to backup: ${backupPath}`)
    }

    fs.renameSync(inputPath, tempPath)
    console.log(`[TEMP ADM] Renamed input file "${inputPath}" -> "${tempPath}" for processing.`)
  } catch (error) {
    console.error('[TEMP ADM] Failed to perform temporary rename:', error)
    if (backupPath && fs.existsSync(backupPath)) {
      try {
        fs.renameSync(backupPath, tempPath)
        console.log('[TEMP ADM] Restored original ADM.wav after rename failure.')
      } catch (restoreErr) {
        console.error('[TEMP ADM] Failed to restore original ADM.wav after rename failure:', restoreErr)
      }
    }
    throw error
  }

  return {
    effectivePath: tempPath,
    restore: () => {
      if (restored) return
      restored = true

      try {
        if (fs.existsSync(tempPath)) {
          fs.renameSync(tempPath, inputPath)
          console.log(`[TEMP ADM] Restored input file name "${tempPath}" -> "${inputPath}".`)
        } else if (!fs.existsSync(inputPath)) {
          console.warn(`[TEMP ADM] Temporary ADM.wav not found; original path "${inputPath}" left unchanged.`)
        }
      } catch (restoreInputErr) {
        console.error('[TEMP ADM] Failed to restore original ADM BWF name:', restoreInputErr)
      }

      if (backupPath) {
        try {
          if (fs.existsSync(backupPath)) {
            fs.renameSync(backupPath, tempPath)
            console.log(`[TEMP ADM] Restored pre-existing ADM.wav from backup -> "${tempPath}".`)
          }
        } catch (restoreBackupErr) {
          console.error('[TEMP ADM] Failed to restore previous ADM.wav file from backup:', restoreBackupErr)
        }
      }
    },
  }
}

const ensureDirectoryExists = (dirPath) => {
  if (!dirPath) return
  const normalized = path.normalize(dirPath)
  if (/^[A-Za-z]:\\?$/.test(normalized)) {
    // 根目录无需创建，也避免 EPERM
    return
  }
  try {
    fs.mkdirSync(dirPath, { recursive: true })
  } catch (error) {
    if (error && error.code !== 'EEXIST') {
      throw error
    }
  }
}

const updateLastParamsOutputPath = (newPath) => {
  if (typeof newPath !== 'string' || newPath.length === 0) return
  if (!fs.existsSync(STATE_FILE_PATH)) return
  try {
    const raw = fs.readFileSync(STATE_FILE_PATH, 'utf-8')
    if (!raw.includes('output_file=')) return
    const updated = raw.replace(/^(output_file=).*$/m, `$1${newPath}`)
    fs.writeFileSync(STATE_FILE_PATH, updated, 'utf-8')
  } catch (error) {
    console.warn('[AUTO OUTPUT] Failed to update last_params output path:', error)
  }
}

const createAutoOutputPlan = (finalPath, safePath) => {
  if (typeof finalPath !== 'string' || finalPath.length === 0) return null
  if (typeof safePath !== 'string' || safePath.length === 0) return null
  if (finalPath === safePath) return null

  ensureDirectoryExists(path.dirname(safePath))

  const plan = {
    finalPath,
    safePath,
    backupPath: null,
    applied: false,
    apply() {
      if (!fs.existsSync(this.safePath)) {
        throw new Error(`临时输出文件不存在: ${this.safePath}`)
      }

      const finalDir = path.dirname(this.finalPath)
      if (finalDir) {
        ensureDirectoryExists(finalDir)
      }

      try {
        if (fs.existsSync(this.finalPath)) {
          const backupSuffix = Date.now().toString(36)
          this.backupPath = `${this.finalPath}.backup_${backupSuffix}`
          fs.renameSync(this.finalPath, this.backupPath)
          console.log(`[AUTO OUTPUT] Existing final output backed up to: ${this.backupPath}`)
        }

        fs.renameSync(this.safePath, this.finalPath)
        console.log(`[AUTO OUTPUT] Output renamed to final path: ${this.finalPath}`)
        this.applied = true
        if (this.backupPath && fs.existsSync(this.backupPath)) {
          fs.rmSync(this.backupPath, { force: true })
          this.backupPath = null
        }
        updateLastParamsOutputPath(this.finalPath)
      } catch (error) {
        if (this.backupPath && fs.existsSync(this.backupPath)) {
          try {
            fs.renameSync(this.backupPath, this.finalPath)
          } catch (restoreErr) {
            console.error('[AUTO OUTPUT] Failed to restore original output file from backup:', restoreErr)
          }
          this.backupPath = null
        }
        // 尽力清理临时文件，避免遗留
        if (fs.existsSync(this.safePath)) {
          try {
            fs.rmSync(this.safePath, { force: true })
          } catch (removeErr) {
            console.error('[AUTO OUTPUT] Failed to remove temporary output after rename failure:', removeErr)
          }
        }
        throw error
      }
    },
    cleanupOnFailure() {
      if (this.backupPath && fs.existsSync(this.backupPath)) {
        try {
          fs.renameSync(this.backupPath, this.finalPath)
          console.log('[AUTO OUTPUT] Restored original final output from backup after failure.')
        } catch (restoreErr) {
          console.error('[AUTO OUTPUT] Failed to restore original output during cleanup:', restoreErr)
        }
        this.backupPath = null
      }
      if (fs.existsSync(this.safePath)) {
        try {
          fs.rmSync(this.safePath, { force: true })
          console.log('[AUTO OUTPUT] Removed temporary output file after failure.')
        } catch (removeErr) {
          console.error('[AUTO OUTPUT] Failed to remove temporary output file during cleanup:', removeErr)
        }
      }
    },
  }

  return plan
}

let mainWindow
let currentProcessInfo = null

const PROGRESS_REGEX = /Overall progress:\s*([0-9]+(?:\.[0-9]+)?)/gi

const terminateProcessTree = (childProcess) => {
  if (!childProcess || childProcess.exitCode !== null) {
    return Promise.resolve(true)
  }

  const pid = childProcess.pid
  if (!pid) {
    return Promise.resolve(true)
  }

  if (process.platform === 'win32') {
    return new Promise((resolve, reject) => {
      const killer = spawn('taskkill', ['/PID', pid.toString(), '/T', '/F'], {
        windowsHide: true,
      })

      killer.on('exit', (code) => {
        // 0 表示成功，128 表示进程不存在，也视为成功
        if (code === 0 || code === 128) {
          resolve(true)
        } else {
          reject(new Error(`taskkill 退出码: ${code}`))
        }
      })

      killer.on('error', (error) => {
        reject(error)
      })
    })
  }

  return new Promise((resolve, reject) => {
    try {
      childProcess.kill('SIGTERM')
    } catch (error) {
      if (error.code === 'ESRCH') {
        resolve(true)
        return
      }
      reject(error)
      return
    }

    const timeout = setTimeout(() => {
      if (childProcess.exitCode === null) {
        try {
          childProcess.kill('SIGKILL')
        } catch (err) {
          // 如果进程已经退出或不支持，忽略错误
        }
      }
      resolve(true)
    }, 2500)

    childProcess.once('exit', () => {
      clearTimeout(timeout)
      resolve(true)
    })
  })
}

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

  const iconPath = getAssetPath('logo.png')

  mainWindow = new BrowserWindow({
    width: 800,
    height: 900,
    title: 'Dolby Encoder GUI',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
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
ipcMain.handle('run-c-program', async (event, rawPayload) => {
  let spawnArgs
  let finalOutputTarget = null
  let safeOutputOverride = null

  if (Array.isArray(rawPayload)) {
    spawnArgs = [...rawPayload]
  } else if (rawPayload && typeof rawPayload === 'object') {
    spawnArgs = Array.isArray(rawPayload.args) ? [...rawPayload.args] : []
    if (typeof rawPayload.finalOutputPath === 'string') {
      finalOutputTarget = rawPayload.finalOutputPath
    }
    if (typeof rawPayload.safeOutputPath === 'string') {
      safeOutputOverride = rawPayload.safeOutputPath
    }
  } else {
    spawnArgs = []
  }

  if (!Array.isArray(spawnArgs)) {
    spawnArgs = []
  }

  if (safeOutputOverride && spawnArgs.length >= 2) {
    spawnArgs[spawnArgs.length - 2] = safeOutputOverride
  }

  console.log('Renderer requested to run C program with args:', spawnArgs)

  const originalInputPath = spawnArgs.length > 0 ? spawnArgs[spawnArgs.length - 1] : ''
  let renameHandle = null
  let outputAutoPlan = null

  const cleanupRename = () => {
    if (!renameHandle) return
    try {
      renameHandle.restore()
    } catch (cleanupErr) {
      console.error('[TEMP ADM] Cleanup encountered an error:', cleanupErr)
    } finally {
      renameHandle = null
    }
  }

  const cleanupOutputPlan = () => {
    if (!outputAutoPlan) return
    try {
      outputAutoPlan.cleanupOnFailure()
    } catch (cleanupErr) {
      console.error('[AUTO OUTPUT] Cleanup encountered an error:', cleanupErr)
    } finally {
      outputAutoPlan = null
    }
  }

  return new Promise((resolve, reject) => {
    let settled = false
    const safeResolve = (value) => {
      if (settled) return
      settled = true
      resolve(value)
    }
    const safeReject = (error) => {
      if (settled) return
      settled = true
      reject(error)
    }

    if (currentProcessInfo && currentProcessInfo.process && currentProcessInfo.process.exitCode === null) {
      const err = new Error('编码任务正在进行中，请先取消当前任务。')
      console.warn(err.message)
      safeReject(err)
      return
    }
    if (!fs.existsSync(C_PROGRAM_PATH)) {
      console.error('C program not found:', C_PROGRAM_PATH)
      safeReject(new Error(`C 程序未找到: ${C_PROGRAM_PATH}`))
      return
    }
    console.log('C program path confirmed:', C_PROGRAM_PATH)
    console.log('Attempting to spawn C program...')
    const env = { ...process.env }
    if (settings && settings.deeRoot) {
      env.DEE_ROOT = settings.deeRoot
    }
    try {
      if (finalOutputTarget) {
        const safeCandidate = spawnArgs.length > 1 ? spawnArgs[spawnArgs.length - 2] : null
        if (typeof safeCandidate === 'string' && safeCandidate.length > 0 && safeCandidate !== finalOutputTarget) {
          outputAutoPlan = createAutoOutputPlan(finalOutputTarget, safeCandidate)
          if (outputAutoPlan && fs.existsSync(outputAutoPlan.safePath)) {
            try {
              fs.rmSync(outputAutoPlan.safePath, { force: true })
              console.log('[AUTO OUTPUT] Cleared previous temporary output file:', outputAutoPlan.safePath)
            } catch (removeErr) {
              console.warn('[AUTO OUTPUT] Failed to clear previous temporary output file:', removeErr)
            }
          }
          if (outputAutoPlan) {
            console.log(`[AUTO OUTPUT] Temporary output path "${outputAutoPlan.safePath}" will be renamed to "${outputAutoPlan.finalPath}" after encoding.`)
          }
        }
      }
    } catch (planError) {
      cleanupOutputPlan()
      safeReject(planError)
      return
    }
    try {
      if (typeof originalInputPath === 'string' && originalInputPath.length > 0) {
        renameHandle = prepareTemporaryAdmRename(originalInputPath)
        if (renameHandle && renameHandle.effectivePath) {
          spawnArgs[spawnArgs.length - 1] = renameHandle.effectivePath
        }
      }
    } catch (renameError) {
      cleanupOutputPlan()
      cleanupRename()
      safeReject(renameError)
      return
    }

    let cProcess
    try {
      cProcess = spawn(C_PROGRAM_PATH, spawnArgs, { cwd: path.dirname(C_PROGRAM_PATH), env })
    } catch (spawnError) {
      cleanupRename()
      cleanupOutputPlan()
      safeReject(spawnError)
      return
    }
    const processInfo = { process: cProcess, wasKilled: false }
    currentProcessInfo = processInfo

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

    cProcess.on('close', (code, signal) => {
      console.log(`C program exited with code: ${code}, signal: ${signal}`)
      const wasKilled = processInfo.wasKilled || Boolean(signal)
      cleanupRename()
      if (currentProcessInfo && currentProcessInfo.process === cProcess) {
        currentProcessInfo = null
      }
      if (wasKilled) {
        cleanupOutputPlan()
        mainWindow.webContents.send('encoding-cancelled', { code, signal })
        safeResolve({ cancelled: true, code, signal })
        return
      }
      if (code !== 0) {
        cleanupOutputPlan()
        mainWindow.webContents.send('encoding-error', `C 程序退出码: ${code}`)
        safeReject(new Error(`C 程序退出码: ${code}`))
      } else {
        try {
          if (outputAutoPlan) {
            const finalPath = outputAutoPlan.finalPath
            outputAutoPlan.apply()
            if (mainWindow) {
              const infoMessage = `[AUTO OUTPUT] Final output path: ${finalPath}`
              mainWindow.webContents.send('console-output', `${infoMessage}\n`)
            }
            outputAutoPlan = null
          }
        } catch (renameError) {
          console.error('[AUTO OUTPUT] Failed to finalize output rename:', renameError)
          cleanupOutputPlan()
          mainWindow.webContents.send('encoding-error', `输出文件重命名失败: ${renameError.message}`)
          safeReject(renameError)
          return
        }
        mainWindow.webContents.send('encoding-complete', code)
        safeResolve({ cancelled: false, code })
      }
    })

    cProcess.on('error', (err) => {
      console.error(`Failed to start C program process: ${err.message}`)
      mainWindow.webContents.send('encoding-error', `启动 C 程序失败: ${err.message}`)
      if (currentProcessInfo && currentProcessInfo.process === cProcess) {
        currentProcessInfo = null
      }
      cleanupRename()
      cleanupOutputPlan()
      safeReject(err)
    })
  })
})

ipcMain.handle('cancel-c-program', async () => {
  if (!currentProcessInfo || !currentProcessInfo.process) {
    return { success: false, reason: 'NO_PROCESS' }
  }

  const { process } = currentProcessInfo

  if (process.exitCode !== null) {
    currentProcessInfo = null
    return { success: false, reason: 'ALREADY_EXITED' }
  }

  try {
    currentProcessInfo.wasKilled = true
    await terminateProcessTree(process)
    return { success: true }
  } catch (error) {
    console.error('Failed to cancel C program:', error)
    return { success: false, reason: 'ERROR', message: error.message }
  }
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
