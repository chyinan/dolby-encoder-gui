# Dolby Encoding Engine GUI

## Overview

Dolby Encoding Engine GUI is a lightweight Electron + Vue 3 desktop helper that wraps the existing Dolby encoding command line (`encode.exe`). It provides a friendly interface for selecting input/output files, switching between Atmos EC3 and Atmos M4A encoding profiles, monitoring real-time logs, and displaying progress as reported by the encoder.

## Key Features

- **Minimal desktop client** built with Electron, Vue 3, and Element Plus.
- **Two encoding profiles** (Atmos EC3 / M4A) exposed through radio buttons.
- **Real-time log viewer** streaming stdout/stderr from `encode.exe`.
- **Progress bar** that parses `Overall progress: <value>` from encoder logs.
- **Parameter persistence** through `last_params.txt` stored in the project root.
- **Configurable external Dolby engine path** stored in a settings dialog (backed by `settings.json`).
- **Language toggle** (English / 中文) via the application menu and shortcuts (`Ctrl/Cmd+Shift+E` / `Ctrl/Cmd+Shift+C`).
- **Configurable encoder path** via the `ENCODE_PATH` environment variable.

## Screenshots

![English UI](./screenshot_EN.png)

## Prerequisites

- **Node.js** 16 or newer (recommended) with npm.
- **A Windows-compatible C toolchain** if you need to rebuild `encode.exe` from `encode.c` (MSVC or MinGW-w64).
- **Dolby Encoding Engine assets** (XML templates, etc.) expected by the CLI encoder.

## Project Structure

- `src/` — Vue renderer code (`App.vue`, Element Plus forms, IPC listeners).
- `src/background.js` — Electron main process. Launches the renderer, configures menus, forwards stdout/stderr, and emits progress events.
- `preload.js` — Exposes a limited `ipcRenderer` bridge to the renderer process.
- `encode.c` — Reference source used to compile `encode.exe`; handles CLI parameters and persisting state.
- `last_params.txt` — Generated state file stored alongside the app (optional, created at runtime).

## Setup & Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Place `encode.exe`, `encode.c` (optional for rebuilding), and any required Dolby assets in the repository root (`dolby-encoder-gui/`).
3. (Optional) Define `ENCODE_PATH` if `encode.exe` lives elsewhere:
   ```cmd
   set ENCODE_PATH=C:\path\to\encode.exe
   ```
4. Start the Electron development server:
   ```bash
   npm run electron:serve
   ```
5. Build a production package (creates an Electron distributable):
   ```bash
   npm run electron:build
   ```

## Compiling `encode.exe`

If you modify `encode.c`, rebuild the executable in the project root:

### Using MSVC (Visual Studio Build Tools)

```cmd
cd /d D:\Dolby_Encoding_Engine\dolby-encoder-gui
cl /W4 /O2 /Fe:encode.exe encode.c
```

### Using MinGW-w64 (GCC)

```bash
cd /d D:\Dolby_Encoding_Engine\dolby-encoder-gui
gcc -O2 -Wall -o encode.exe encode.c
```

## Usage

1. Launch the app (`npm run electron:serve` or a packaged build).
2. Pick the ADM WAV input file and set an output path.
3. Choose the encoding profile (Atmos EC3 or Atmos M4A).
4. Optionally enter start/end times and leading/trailing silence durations.
5. Click **Start Encoding** to invoke `encode.exe` with the provided parameters.
6. Observe progress and logs:
   - Logs display in real time.
   - Progress bar updates whenever the log contains `Overall progress: <value>`.
7. Use **Settings** (top-right button) to configure the Dolby engine folder (`dee.exe`, XML templates, temp directory). The selected path is saved to `settings.json` under the Electron user data directory and passed to `encode.exe` via the `DEE_ROOT` environment variable.
8. Use **Load Last Params** to restore the last successful configuration from `last_params.txt`.
9. Press **Exit** to quit the application.

## Notes & Troubleshooting

- Ensure `encode.exe` has access to the Dolby XML templates referenced inside `encode.c`.
- The Dolby engine path defaults to `D:\Dolby_Encoding_Engine`. Update it via **Settings** if your assets live elsewhere. The same path is also accepted from the `DEE_ROOT` environment variable.
- `last_params.txt` is read/written in the project root. Delete it to reset persisted values.
- If progress stays at 0%, verify that the encoder logs still include `Overall progress:` lines.
- The UI defaults to English. Use the `Language` menu or shortcuts to switch to 中文.

---

# Dolby Encoding Engine GUI（中文版）

## 简介

Dolby Encoding Engine GUI 是一个基于 Electron + Vue 3 的桌面工具，用来封装 Dolby 官方命令行编码器 `encode.exe`。它提供简单的图形界面，用于选择输入/输出文件、切换编码格式、实时查看日志，并根据编码器输出的进度信息更新进度条。

## 功能亮点

- **轻量桌面客户端**：Electron、Vue 3、Element Plus 构建。
- **两种编码类型**：Dolby Atmos EC3 / M4A 单选切换。
- **实时日志输出**：展示 `encode.exe` 的标准输出和错误输出。
- **进度条联动**：从日志中的 `Overall progress: <数值>` 自动解析进度。
- **参数持久化**：通过项目根目录下的 `last_params.txt` 记录上次操作。
- **中英文切换**：菜单选择或快捷键切换（`Ctrl/Cmd+Shift+E` 切英文，`Ctrl/Cmd+Shift+C` 切中文）。
- **可配置编码器路径**：支持通过 `ENCODE_PATH` 环境变量指定 `encode.exe`。

## 截图

![Chinese UI](./screenshot_CN.png)

## 环境依赖

- 建议安装 **Node.js 16+** 及 npm。
- 需要 **Windows C 编译环境**（MSVC 或 MinGW-w64）以便修改后重新编译 `encode.exe`。
- 准备好 Dolby Encoding Engine 所需的 XML 模板等资源。

## 项目结构

- `src/`：Vue 前端代码（`App.vue`、表单、IPC 监听）。
- `src/background.js`：Electron 主进程，负责窗口管理、菜单、日志转发、进度事件。
- `preload.js`：向渲染进程暴露受限的 `ipcRenderer` API。
- `encode.c`：命令行核心源码，用于编译 `encode.exe`，负责保存/加载参数。
- `last_params.txt`：运行时生成的参数缓存文件（位于项目根目录）。

## 开发与运行步骤

1. 安装依赖：
   ```bash
   npm install
   ```
2. 将 `encode.exe`、`encode.c`（可选，用于重新编译）以及所需资源放在仓库根目录 `dolby-encoder-gui\`。
3. （可选）若 `encode.exe` 位于其他目录，设置环境变量：
   ```cmd
   set ENCODE_PATH=C:\路径\encode.exe
   ```
4. 启动开发模式：
   ```bash
   npm run electron:serve
   ```
5. 构建发行版：
   ```bash
   npm run electron:build
   ```

## 编译 `encode.exe`

若对 `encode.c` 有改动，可选择以下工具链之一在项目根目录编译：

### MSVC（Visual Studio Build Tools）

```cmd
cd /d D:\Dolby_Encoding_Engine\dolby-encoder-gui
cl /W4 /O2 /Fe:encode.exe encode.c
```

### MinGW-w64（GCC）

```bash
cd /d D:\Dolby_Encoding_Engine\dolby-encoder-gui
gcc -O2 -Wall -o encode.exe encode.c
```

## 使用流程

1. 启动应用（开发模式或打包版本）。
2. 选择 ADM WAV 输入文件和输出保存路径。
3. 切换需要的编码类型（Atmos EC3 或 Atmos M4A）。
4. 如需可填写起始/结束时间和首尾静音时长。
5. 点击 **开始编码**，程序会携带参数调用 `encode.exe`。
6. 日志与进度：
   - 日志实时显示。
   - 当日志出现 `Overall progress:` 时，进度条会同步更新。
7. 点击 **加载上次参数** 可以恢复 `last_params.txt` 中的配置。
8. **退出** 按钮用于关闭程序。

## 注意事项

- 请确保 `encode.exe` 能访问到 `encode.c` 中引用的 Dolby XML 模板路径。
- `last_params.txt` 存放在项目根目录，可删除以清空历史记录。
- 如果进度条始终为 0%，请确认编码日志仍包含 `Overall progress:` 字样。
- 应用默认语言为英文，可通过菜单或快捷键切换至中文。
- Dolby 工具目录默认指向 `D:\Dolby_Encoding_Engine`，如有不同安装位置，请通过 **设置** 按钮或 `DEE_ROOT` 环境变量修改。
