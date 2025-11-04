<template>
  <el-container style="padding: 20px;">
    <el-header>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h1>{{ t('title') }}</h1>
        <el-button @click="openSettings">{{ t('settings') }}</el-button>
      </div>
    </el-header>
    <el-main>
      <el-form :model="form" label-width="120px">
        <el-form-item :label="t('inputFile')">
          <el-input v-model="form.inputFile" placeholder="D:\ADM.wav"></el-input>
          <el-button @click="selectInputFile" style="margin-top:8px">{{ t('browse') }}</el-button>
        </el-form-item>

        <el-form-item :label="t('outputFile')">
          <el-input v-model="form.outputFile" :placeholder="defaultOutputFile"></el-input>
          <el-button @click="selectOutputFile" style="margin-top:8px">{{ t('browse') }}</el-button>
        </el-form-item>

        <el-form-item :label="t('encodeType')">
          <el-radio-group v-model="form.choice">
            <el-radio :value="1">{{ t('optionEC3') }}</el-radio>
            <el-radio :value="2">{{ t('optionM4A') }}</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item :label="t('startTime')">
          <el-input v-model="form.start" :placeholder="t('placeholderStart')"></el-input>
        </el-form-item>

        <el-form-item :label="t('endTime')">
          <el-input v-model="form.end" :placeholder="t('placeholderEnd')"></el-input>
        </el-form-item>

        <el-form-item :label="t('prependSilence')">
          <el-input v-model="form.prependSilence" :placeholder="t('placeholderPrepend')"></el-input>
        </el-form-item>

        <el-form-item :label="t('appendSilence')">
          <el-input v-model="form.appendSilence" :placeholder="t('placeholderAppend')"></el-input>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="startEncoding" :disabled="isEncoding">{{ t('startEncodingBtn') }}</el-button>
          <el-button type="danger" @click="cancelEncoding" :disabled="!isEncoding">{{ t('cancelEncodingBtn') }}</el-button>
          <el-button @click="loadLastParams" :disabled="isEncoding">{{ t('loadLastParamsBtn') }}</el-button>
          <el-button @click="exitApp">{{ t('exitBtn') }}</el-button>
        </el-form-item>
      </el-form>

      <div v-if="showProgress" style="margin: 20px 0;">
        <el-progress :percentage="Math.round(progress)" :status="progress >= 100 ? 'success' : undefined"></el-progress>
      </div>

      <el-card class="box-card" style="margin-top: 20px;">
        <template #header>
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
            <span>{{ t('logOutputTitle') }}</span>
            <el-button size="small" type="warning" plain @click="clearLog" :disabled="!logOutput">{{ t('clearLogBtn') }}</el-button>
          </div>
        </template>
        <div style="white-space: pre-wrap; max-height: 300px; overflow-y: auto; background-color: #f5f5f5; padding: 10px; border-radius: 4px;">
          {{ logOutput }}
        </div>
      </el-card>
    </el-main>

    <el-dialog v-model="settingsDialogVisible" :title="t('settingsTitle')" width="480px">
      <el-form label-width="140px">
        <el-form-item :label="t('deeRootLabel')">
          <el-input v-model="deeRootInput" :placeholder="t('deeRootPlaceholder')"></el-input>
          <el-button style="margin-top:8px" @click="browseDeeRoot">{{ t('browse') }}</el-button>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="closeSettings">{{ t('cancelButton') }}</el-button>
        <el-button type="primary" @click="saveSettings">{{ t('saveButton') }}</el-button>
      </template>
    </el-dialog>
  </el-container>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

// 注意：window.ipcRenderer 将通过 preload.js 暴露
const ipcRenderer = window.ipcRenderer

// 简单的 i18n
const lang = ref(localStorage.getItem('lang') || 'en')
let suppressLanguageToast = true
const messages = {
  zh: {
    title: 'Dolby Encoding Engine 前端工具',
    settings: '设置',
    settingsTitle: '设置',
    deeRootLabel: 'dee目录',
    deeRootPlaceholder: '请选择 dee.exe 所在目录',
    saveButton: '保存',
    inputFile: '输入文件',
    browse: '浏览',
    outputFile: '输出文件',
    encodeType: '编码类型',
    optionEC3: 'Dolby Atmos EC3',
    optionM4A: 'Dolby Atmos M4A',
    startTime: '起始时间',
    endTime: '结束时间',
    prependSilence: '开头静音时长',
    appendSilence: '结尾静音时长',
    startEncodingBtn: '开始编码',
    cancelEncodingBtn: '取消编码',
    loadLastParamsBtn: '加载上次参数',
    exitBtn: '退出',
    logOutputTitle: '日志输出',
    clearLogBtn: '清空日志',
    logCleared: '日志已清空',
    placeholderStart: 'HH:MM:SS:FF / HH:MM:SS.xx',
    placeholderEnd: 'HH:MM:SS:FF / HH:MM:SS.xx',
    placeholderPrepend: '秒，如10.0',
    placeholderAppend: '秒，如5.0',
    encodingComplete: '编码完成，退出码: ',
    encodingError: '编码错误: ',
    encodingStarting: '开始编码...',
    encodingCancelled: '编码已取消',
    startFailed: '启动编码进程失败: ',
    cancelRequested: '已请求取消编码...',
    cancelEncodingFailed: '取消编码失败: ',
    encodingInProgress: '编码任务正在进行中。',
    loadingLast: '正在加载上次参数...',
    loadedLastOk: '成功加载上次参数。',
    loadedLastNone: '未找到有效的上次操作记录。',
    loadParamsFail: '加载参数失败: ',
    confirmExitTitle: '提示',
    confirmExitMessage: '确定要退出应用程序吗？',
    confirmButton: '确定',
    cancelButton: '取消',
    languageSwitched: '已切换为中文',
    deeRootUpdated: 'Dolby 工具路径已更新',
    deeRootSelectError: '无法选择目录',
    loadSettingsFail: '加载设置失败: ',
    saveSettingsFail: '保存设置失败: ',
    pathIllegalChars: '文件路径不能包含双引号，请更换路径后重试。',
    inputFileMissing: '输出失败：输入文件不存在。'
  },
  en: {
    title: 'Dolby Encoding Engine Tool',
    settings: 'Settings',
    settingsTitle: 'Dolby Encoding Engine Settings',
    deeRootLabel: 'Dolby Engine Directory',
    deeRootPlaceholder: 'Select the folder containing dee.exe',
    saveButton: 'Save',
    inputFile: 'Input File',
    browse: 'Browse',
    outputFile: 'Output File',
    encodeType: 'Encoding Type',
    optionEC3: 'Dolby Atmos EC3',
    optionM4A: 'Dolby Atmos M4A',
    startTime: 'Start Time',
    endTime: 'End Time',
    prependSilence: 'Leading Silence (s)',
    appendSilence: 'Trailing Silence (s)',
    startEncodingBtn: 'Start Encoding',
    cancelEncodingBtn: 'Cancel Encoding',
    loadLastParamsBtn: 'Load Last Params',
    exitBtn: 'Exit',
    logOutputTitle: 'Log Output',
    clearLogBtn: 'Clear Log',
    logCleared: 'Log cleared',
    placeholderStart: 'HH:MM:SS:FF / HH:MM:SS.xx',
    placeholderEnd: 'HH:MM:SS:FF / HH:MM:SS.xx',
    placeholderPrepend: 'seconds, e.g. 10.0',
    placeholderAppend: 'seconds, e.g. 5.0',
    encodingComplete: 'Encoding finished, exit code: ',
    encodingError: 'Encoding error: ',
    encodingStarting: 'Starting encoding...',
    encodingCancelled: 'Encoding cancelled',
    startFailed: 'Failed to start encoding: ',
    cancelRequested: 'Cancellation requested...',
    cancelEncodingFailed: 'Failed to cancel encoding: ',
    encodingInProgress: 'Encoding already in progress.',
    loadingLast: 'Loading last parameters...',
    loadedLastOk: 'Successfully loaded last parameters.',
    loadedLastNone: 'No valid previous operation found.',
    loadParamsFail: 'Failed to load parameters: ',
    confirmExitTitle: 'Confirm',
    confirmExitMessage: 'Are you sure you want to quit?',
    confirmButton: 'OK',
    cancelButton: 'Cancel',
    languageSwitched: 'Switched to English',
    deeRootUpdated: 'Dolby engine path updated',
    deeRootSelectError: 'Failed to choose directory',
    loadSettingsFail: 'Failed to load settings: ',
    saveSettingsFail: 'Failed to save settings: ',
    pathIllegalChars: 'File paths cannot contain double quotes. Please choose a different location.',
    inputFileMissing: 'Encoding failed: input file does not exist.'
  },
}

const t = (key) => messages[lang.value]?.[key] ?? key

const form = reactive({
  choice: 1, // 默认为 EC3
  inputFile: 'D:\\ADM.wav',
  outputFile: '',
  start: '',
  end: '',
  prependSilence: '',
  appendSilence: '',
})

const hasIllegalPathChars = (value) => {
  if (typeof value !== 'string') return false
  return /"/.test(value)
}

const lastValidInputPath = ref(form.inputFile)
const lastValidOutputPath = ref(form.outputFile)

const lastErrorIsMissingFile = ref(false)

watch(() => form.inputFile, (newVal) => {
  if (newVal === lastValidInputPath.value) return
  if (!newVal) {
    lastValidInputPath.value = ''
    return
  }
  if (hasIllegalPathChars(newVal)) {
    ElMessage.error(t('pathIllegalChars'))
    form.inputFile = lastValidInputPath.value
  } else {
    lastValidInputPath.value = newVal
  }
})

watch(() => form.outputFile, (newVal) => {
  if (newVal === lastValidOutputPath.value) return
  if (!newVal) {
    lastValidOutputPath.value = ''
    return
  }
  if (hasIllegalPathChars(newVal)) {
    ElMessage.error(t('pathIllegalChars'))
    form.outputFile = lastValidOutputPath.value
  } else {
    lastValidOutputPath.value = newVal
  }
})

const logOutput = ref('')
const progress = ref(0)
const showProgress = ref(false)
const isEncoding = ref(false)
const settingsDialogVisible = ref(false)
const deeRootInput = ref('')

const clearLog = () => {
  if (!logOutput.value) return
  logOutput.value = ''
  ElMessage.success(t('logCleared'))
}

const currentSettings = ref({ deeRoot: '', language: lang.value })

const defaultOutputFile = computed(() => {
  return form.choice === 1 ? 'D:\\atmos.ec3' : 'D:\\atmos.m4a'
})

let progressHideTimer = null
const scheduleHideProgress = () => {
  if (progressHideTimer) clearTimeout(progressHideTimer)
  progressHideTimer = setTimeout(() => {
    showProgress.value = false
  }, 2000)
}

// 监听 C 程序输出
onMounted(() => {
  if (ipcRenderer) {
    loadSettingsFromMain()
      .then((settingsResult) => {
        if (!settingsResult || !['en', 'zh'].includes(settingsResult.language)) {
          ipcRenderer.invoke('persist-language', lang.value).catch(() => {})
        }
      })
    ipcRenderer.on('console-output', (event, data) => {
      logOutput.value += data + '\n'
      if (typeof data === 'string') {
        const match = data.match(/Overall progress:\s*([0-9]+(?:\.[0-9]+)?)/gi)
        if (match) {
          progress.value = Math.min(100, Number.isFinite(match[0].split(':')[1].trim()) ? Number(match[0].split(':')[1].trim()) : 0)
          showProgress.value = true
          if (progress.value >= 100) {
            scheduleHideProgress()
          }
        }
        const matchMissing = data.match(/Storage:\s*File\s+"(.+?)"\s+does\s+not\s+exist/i)
        if (matchMissing) {
          lastErrorIsMissingFile.value = true
        }
      }
    })
    ipcRenderer.on('encoding-complete', (event, code) => {
      isEncoding.value = false
      ElMessage.success(`编码完成，退出码: ${code}`)
      logOutput.value += `编码完成，退出码: ${code}\n`
      lastErrorIsMissingFile.value = false
      progress.value = 100
      showProgress.value = true
      scheduleHideProgress()
    })
    ipcRenderer.on('encoding-error', (event, error) => {
      isEncoding.value = false
      ElMessage.error(`${t('encodingError')}${error}`)
      logOutput.value += `编码错误: ${error}\n`
      if (lastErrorIsMissingFile.value || /Storage:\s*File\s+"(.+?)"\s+does\s+not\s+exist/i.test(error)) {
        ElMessage.error(t('inputFileMissing'))
        lastErrorIsMissingFile.value = false
      }
      scheduleHideProgress()
    })
    ipcRenderer.on('encoding-progress', (event, value) => {
      progress.value = Math.min(100, Number.isFinite(value) ? value : 0)
      showProgress.value = true
      if (progress.value >= 100) {
        scheduleHideProgress()
      }
    })
    ipcRenderer.on('encoding-cancelled', () => {
      isEncoding.value = false
      ElMessage.info(t('encodingCancelled'))
      logOutput.value += `${t('encodingCancelled')}\n`
      scheduleHideProgress()
    })
    ipcRenderer.on('settings-updated', (event, newSettings) => {
      applySettings(newSettings)
    })
    ipcRenderer.on('set-language', (event, newLang) => {
      if (newLang === 'en' || newLang === 'zh') {
        const changed = lang.value !== newLang
        lang.value = newLang
        localStorage.setItem('lang', newLang)
        currentSettings.value = { ...currentSettings.value, language: newLang }
        if (!suppressLanguageToast && changed) {
          ElMessage.success(t('languageSwitched'))
        }
        suppressLanguageToast = false
      }
    })
  } else {
    ElMessage.error('ipcRenderer 未定义，请检查 Electron 配置。')
  }
})

onUnmounted(() => {
  if (progressHideTimer) {
    clearTimeout(progressHideTimer)
    progressHideTimer = null
  }
  if (ipcRenderer) {
    ipcRenderer.removeAllListeners('console-output')
    ipcRenderer.removeAllListeners('encoding-complete')
    ipcRenderer.removeAllListeners('encoding-error')
    ipcRenderer.removeAllListeners('encoding-progress')
    ipcRenderer.removeAllListeners('encoding-cancelled')
    ipcRenderer.removeAllListeners('settings-updated')
    ipcRenderer.removeAllListeners('set-language')
  }
})

// 选择输入文件
const selectInputFile = async () => {
  if (!ipcRenderer) {
    ElMessage.error('IPC 通信不可用。')
    return
  }
  const result = await ipcRenderer.invoke('open-file-dialog', {
    properties: ['openFile'],
    filters: [{ name: 'ADM BWF Files', extensions: ['wav'] }]
  })
  if (result && !result.canceled && result.filePaths.length > 0) {
    form.inputFile = result.filePaths[0]
  }
}

// 选择输出文件
const selectOutputFile = async () => {
  if (!ipcRenderer) {
    ElMessage.error('IPC 通信不可用。')
    return
  }
  const defaultPath = form.outputFile || defaultOutputFile.value
  const result = await ipcRenderer.invoke('save-file-dialog', {
    defaultPath: defaultPath,
    filters: [
      { name: 'Dolby Atmos EC3', extensions: ['ec3'] },
      { name: 'Dolby Atmos M4A', extensions: ['m4a'] },
    ]
  })
  if (result && !result.canceled && result.filePath) {
    form.outputFile = result.filePath
  }
}

const loadSettingsFromMain = async () => {
  if (!ipcRenderer) return null
  try {
    const result = await ipcRenderer.invoke('get-settings')
    applySettings(result)
    return result
  } catch (error) {
    ElMessage.error(`${t('loadSettingsFail')}${error.message}`)
    return null
  }
}

const applySettings = (data) => {
  if (!data) return
  currentSettings.value = { ...currentSettings.value, ...data }
  deeRootInput.value = currentSettings.value.deeRoot || ''
  const newLang = currentSettings.value.language
  if (newLang && ['en', 'zh'].includes(newLang) && newLang !== lang.value) {
    lang.value = newLang
    localStorage.setItem('lang', newLang)
  }
}

const openSettings = () => {
  deeRootInput.value = currentSettings.value.deeRoot || ''
  settingsDialogVisible.value = true
}

const closeSettings = () => {
  settingsDialogVisible.value = false
}

const browseDeeRoot = async () => {
  if (!ipcRenderer) return
  try {
    const result = await ipcRenderer.invoke('choose-dee-root')
    if (result && !result.canceled && result.filePaths?.length) {
      deeRootInput.value = result.filePaths[0]
    }
  } catch (error) {
    ElMessage.error(t('deeRootSelectError'))
  }
}

const saveSettings = async () => {
  if (!ipcRenderer) return
  try {
    const payload = { deeRoot: deeRootInput.value.trim() }
    const updated = await ipcRenderer.invoke('update-settings', payload)
    applySettings(updated)
    settingsDialogVisible.value = false
    ElMessage.success(t('deeRootUpdated'))
  } catch (error) {
    ElMessage.error(`${t('saveSettingsFail')}${error.message}`)
  }
}

// 开始编码
const startEncoding = async () => {
  if (!ipcRenderer) {
    ElMessage.error('IPC 通信不可用。')
    return
  }

  if (isEncoding.value) {
    ElMessage.warning(t('encodingInProgress'))
    return
  }

  logOutput.value = '' // 清空日志
  const currentOutputFile = form.outputFile || defaultOutputFile.value;

  if (hasIllegalPathChars(form.inputFile) || hasIllegalPathChars(currentOutputFile)) {
    ElMessage.error(t('pathIllegalChars'))
    return
  }

  if (!form.inputFile) {
    ElMessage.error(t('inputFileMissing'))
    return
  }

  try {
    const exists = await ipcRenderer.invoke('check-file-exists', form.inputFile)
    if (!exists) {
      ElMessage.error(t('inputFileMissing'))
      return
    }
  } catch (error) {
    ElMessage.error(t('inputFileMissing'))
    return
  }

  // 创建一个临时的纯 JavaScript 对象来确保参数的稳定性
  const paramsToEncode = {
    choice: form.choice.toString(),
    start: form.start,
    end: form.end,
    prependSilence: form.prependSilence,
    appendSilence: form.appendSilence,
    outputFile: currentOutputFile,
    inputFile: form.inputFile,
  }

  const args = [
    paramsToEncode.choice,
    paramsToEncode.start,
    paramsToEncode.end,
    paramsToEncode.prependSilence,
    paramsToEncode.appendSilence,
    paramsToEncode.outputFile,
    paramsToEncode.inputFile,
  ]
  
  isEncoding.value = true
  if (progressHideTimer) {
    clearTimeout(progressHideTimer)
    progressHideTimer = null
  }
  progress.value = 0
  showProgress.value = true
  ElMessage.info(t('encodingStarting'))
  try {
    await ipcRenderer.invoke('run-c-program', args)
    // C 程序输出将在 'console-output' 事件中接收
  } catch (error) {
    ElMessage.error(`${t('startFailed')}${error.message}`)
    logOutput.value += `${t('startFailed')}${error.message}\n`
    scheduleHideProgress()
  } finally {
    isEncoding.value = false
  }
}

const cancelEncoding = async () => {
  if (!ipcRenderer) {
    ElMessage.error('IPC 通信不可用。')
    return
  }

  if (!isEncoding.value) {
    return
  }

  try {
    const result = await ipcRenderer.invoke('cancel-c-program')
    if (result && result.success) {
      ElMessage.info(t('cancelRequested'))
    } else if (result && (result.reason === 'ALREADY_EXITED' || result.reason === 'NO_PROCESS')) {
      isEncoding.value = false
    } else if (result && result.message) {
      ElMessage.error(`${t('cancelEncodingFailed')}${result.message}`)
    } else {
      ElMessage.error(t('cancelEncodingFailed'))
    }
  } catch (error) {
    ElMessage.error(`${t('cancelEncodingFailed')}${error.message}`)
  }
}

// 加载上次参数
const loadLastParams = async () => {
  if (!ipcRenderer) {
    ElMessage.error('IPC 通信不可用。')
    return
  }
  try {
    ElMessage.info(t('loadingLast'))
    const params = await ipcRenderer.invoke('load-c-params')
    
    if (params && params.valid) {
      form.choice = params.choice
      form.start = params.start
      form.end = params.end
      form.prependSilence = params.prepend_silence
      form.appendSilence = params.append_silence
      // 确保 output_file 和 input_file 有值才更新，否则保持当前或默认
      if (params.output_file) form.outputFile = params.output_file
      if (params.input_file) form.inputFile = params.input_file
      
      ElMessage.success(t('loadedLastOk'))
    } else {
      ElMessage.warning(t('loadedLastNone'))
    }
  } catch (error) {
    ElMessage.error(`${t('loadParamsFail')}${error.message}`)
  }
}

// 退出应用
const exitApp = () => {
  ElMessageBox.confirm(
    t('confirmExitMessage'),
    t('confirmExitTitle'),
    {
      confirmButtonText: t('confirmButton'),
      cancelButtonText: t('cancelButton'),
      type: 'warning',
    }
  ).then(() => {
    if (ipcRenderer) {
      ipcRenderer.send('quit-app')
    } else {
      window.close() // Fallback for browser environment
    }
  }).catch(() => {
    // 用户取消
  })
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
}
</style>
