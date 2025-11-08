# Dolby Encoder GUI

[![release](https://img.shields.io/badge/release-v1.0-blue.svg)](./dist_electron)
[![electron](https://img.shields.io/badge/electron-13.0-47848F.svg)](https://www.electronjs.org/)
[![vue](https://img.shields.io/badge/vue-3.2-41B883.svg)](https://vuejs.org/)
[![python](https://img.shields.io/badge/python-3.9+-3776AB.svg)](https://www.python.org/)
[![license](https://img.shields.io/badge/license-MIT-ff69b4.svg)](./LICENSE)

A cross-platform, open-source graphical interface for Dolby Encoding Engine (DEE) workflows.
Designed for creators who need an easier way to render ADM BWF projects into TrueHD, DD+, or EAC3-JOC deliverables — without touching the command line.

---

## 🔍 At a Glance

| Capability | Details |
| --- | --- |
| Supported inputs | ADM BWF (Atmos mixes) |
| Output workflows | Atmos EC3 · Atmos M4A · Atmos TrueHD (MLP) · Dolby Digital Plus 7.1 for Blu-ray<br>· Dolby Atmos M4A 5.1.2 for Blu-ray |
| OS target | Windows (Electron build) |
| Core engine | Dolby Encoding Engine 5.x (`dee.exe`) |
| Extra tooling | `deew` Python package · `deezy` CLI · `ffmpeg` for final mux |
| Languages | English · Chinese |

---

## ✨ Key Features

- Real-time log streaming and progress bar synced with `dee.exe` output.
- Settings dialog to persist the Dolby engine root (`dee.exe` + `xml_templates`).
- Parameter persistence (`last_params.txt`) to restore the latest successful encode.
- Post-processing pipeline for Blu-ray: run `deew`/`deezy` → clean intermediates → remux with `ffmpeg` → final `.m4a`.
- Bilingual UI toggle (English / Chinese) plus quick keyboard shortcuts.

---

## 📦 Requirements

- **Node.js 16+** and npm for development / packaging.
- **deew** – available in two ways:
  - Preferred: Place `deew.exe` in PATH (single-file executable).
  - Fallback: Install via `pip install deew` (requires Python 3.9+ accessible via `python` or `py` on PATH).
  - ⚠️ **First-time setup**: On first run, `deew` opens a command-line configuration prompt asking for the Dolby Encoding Engine folder path and the `ffmpeg` path.
- **deezy** – install the CLI and keep `deezy` (or `deezy.exe`) on PATH so the app can invoke it directly.
- **ffmpeg** – ensure the binary is present on PATH.
- **Dolby Encoding Engine** (DEE 5.1–5.2). Keep its `dee.exe`, `xml_templates/`, `DolbyTemp/` folders intact.

> 📝 `encode.exe` ships with the project. Rebuild it only when you change `encode.c` or need a custom toolchain.

---

## 🚀 Quick Start

```bash
# 1. Install UI dependencies
npm install

# 2. Launch the development build
npm run electron:serve

# 3. Package for production
npm run electron:build
```

1. Place/keep `encode.exe` in the repo root (already provided).
2. Ensure the Dolby Encoding Engine assets exist on disk (e.g. `D:\Dolby_Encoding_Engine`).
3. In the app, open **Settings → Engine Directory** and browse to the DEE root.
4. (Optional) Set `ENCODE_PATH` if you keep `encode.exe` elsewhere:
   ```cmd
   set ENCODE_PATH=D:\tools\encode.exe
   ```
5. Provide ADM WAV input + output name, pick the workflow, hit **Start Encoding**.

During the Blu-ray profiles, the UI holds at 99% with a "converting" toast while `deew`/`deezy` and `ffmpeg` finish. When everything succeeds you’ll see `Encoding finished, exit code: 0` and the progress bar snaps to 100%.

## 📸 Screenshots

 ![Main workflow UI](./screenshot_EN.png)

---

## ⚙️ Configuration Tips

- **Engine Directory** – stored in Electron user-data. Change it via Settings without editing env vars.
- **Language menu** – `Ctrl/Cmd+Shift+E` (English) · `Ctrl/Cmd+Shift+C` (Chinese).
- **Paths** – avoid double quotes in file paths; the UI guards against illegal characters.
- **Temp cleanup** – Blu-ray workflows remove intermediate `.mlp/.eb3/.mll/.log/.ec3` files automatically.
- **deew first-run setup** – When `deew` runs for the first time, it pops up a command-line prompt that collects the Dolby Encoding Engine folder path and the `ffmpeg` path. Complete this one-time setup before encoding.
- **deezy availability** – Make sure `deezy` resolves from PATH; no additional configuration is required beyond installing the CLI.

---

## 🧪 Troubleshooting

- Progress stuck at 0% ➜ check `dee.exe` logs still emit `Overall progress:` lines.
- `deew` execution fails ➜ ensure either `deew.exe` is in PATH, or Python 3.9+ with `deew` package installed (`pip install deew`) is accessible on PATH. On first run, complete the configuration dialog that prompts for Dolby Encoding Engine and ffmpeg paths.
- `deezy` execution fails ➜ confirm the CLI is installed and the `deezy` command is reachable from PATH.
- `ffmpeg` header error ➜ confirm you're using a build that supports `-c:a copy` with E-AC-3 inside MP4 (`ffmpeg` 5.x/6.x works).
- Need a fresh start ➜ delete `last_params.txt` in the project root.

---

## ⚖️ Legal Notice

- This project is not affiliated with or endorsed by Dolby Laboratories.
- “Dolby”, “Dolby Atmos”, “Dolby TrueHD”, and “Dolby Digital Plus (DD+)” are registered trademarks of Dolby Laboratories Licensing Corporation.
- This software does not contain or redistribute any proprietary Dolby components — it only provides a graphical user interface for users who already have access to official Dolby command-line tools.

---

## 🤝 Credits

- Dolby Encoding Engine (commercial software) for the core transcodes.
- [deew](https://github.com/pcroland/deew) for the open-source wrapper enabling the Blu-ray Dolby Digital Plus pipeline.
- [deezy](https://github.com/jessielw/DeeZy) for the Atmos Blu-ray remux helper.
- ffmpeg project for the MP4 remuxing stage.

---

# Dolby Encoder GUI

用于杜比编码引擎 （DEE） 工作流程的开源GUI。
专为需要更简单的方式将 ADM BWF 项目渲染为 TrueHD、DD+ 或 EAC3-JOC 可交付成果的创作者而设计，而无需接触命令行。

## ✨ 功能亮点

- 实时跟踪 `dee.exe` 日志及进度条。
- 设置可持久化保存 Dolby 引擎根目录路径。
- `last_params.txt` 自动记录最近一次成功参数。
- Blu-ray 流程自动调用 `deew`/`deezy` → 清理中间文件 → `ffmpeg` 重新封装为 `.m4a`。
- 支持中英文界面，一键切换。

## 📦 环境依赖

- **Node.js 16+** 与 npm。
- **deew** – 支持两种使用方式：
  - 推荐方式：将 `deew.exe` 添加到 PATH 环境变量中（单文件可执行程序）。
  - 备选方式：通过 `pip install deew` 安装（需要 Python 3.9+ 且 `python`/`py` 命令可用）。
  - ⚠️ **首次配置**：首次运行 `deew` 时会在命令行中弹出路径配置对话行，需要填写 Dolby Encoding Engine 文件夹路径和 ffmpeg 路径。
- **deezy** – 确保 `deezy`项目已加入 PATH，应用即可直接调用。
- **ffmpeg**（需添加至 PATH）。
- **Dolby Encoding Engine**（存放 `dee.exe` 与其 `xml_templates/`、`DolbyTemp/` 等目录）。

## 🚀 快速上手

```bash
npm install
npm run electron:serve
# 或打包发行
npm run electron:build
```

1. 仓库已提供 `encode.exe`，无需另行放置。
2. 确保本地已安装 Dolby Encoding Engine，例如 `D:\Dolby_Encoding_Engine`。
3. 打开应用 → **设置 → dee 目录**，选择上述根目录。
4. （可选）若自定义 `encode.exe` 路径，可设置环境变量：
   ```cmd
   set ENCODE_PATH=D:\路径\encode.exe
   ```
5. 选择 ADM WAV 输入、输出文件名，挑选所需编码流程并开始。

Blu-ray 流程中，进度条会在 99% 停留并提示“正在转换…”，待 `deew`/`deezy` 与 `ffmpeg` 完成后才显示 100%。

## 📸 截图

![主界面](./screenshot_CN.png)

## ⚙️ 配置说明

- **dee 目录** 通过设置界面修改，无需手动编辑配置文件。
- **语言切换** 快捷键：`Ctrl/Cmd+Shift+E`（英文）、`Ctrl/Cmd+Shift+C`（中文）。
- **路径合法性**：UI 会校验双引号等非法字符，避免编解码失败。
- **临时文件**：Blu-ray 流程结束后会自动删除 `.mlp/.eb3/.ec3/.mll/.log` 等中间文件。
- **deew 首次配置**：首次运行 `deew` 时会在命令行中弹出路径配置对话行，要求填写 Dolby Encoding Engine 文件夹路径和 ffmpeg 路径，完成此一次性配置后才能正常编码。
- **deezy 命令**：确认 `deezy` 命令可在命令行直接执行，无需额外配置。

## 🧪 常见问题

- 进度条停在 0% ➜ 确认 `dee.exe` 日志仍输出 `Overall progress:`。
- `deew` 执行失败 ➜ 确认已将 `deew.exe` 添加至 PATH 环境变量，或已安装 Python 3.9+ 并通过 `pip install deew` 安装 deew 包。首次运行时会弹出配置对话框，需要填写 Dolby Encoding Engine 和 ffmpeg 路径。
- `deezy` 执行失败 ➜ 检查 `deezy` 命令可在 PATH 中找到。
- `ffmpeg` 报头部错误 ➜ 使用支持 E-AC-3 copy 的 `ffmpeg` 版本并确保在PATH环境变量中。
- 重置参数 ➜ 删除项目根目录下的 `last_params.txt`。

## ⚖️ 法律声明

- 该项目不隶属于杜比实验室，也不受杜比实验室认可。
- “杜比”、“杜比全景声”、“杜比 TrueHD”和“杜比数字增强 （DD+）”是杜比实验室许可公司的注册商标。
- 该软件不包含或重新分发任何专有的杜比组件——它仅为已经有权访问官方杜比命令行工具的用户提供图形用户界面。

## 🤝 鸣谢

- Dolby Encoding Engine（商业软件）。
- [deew](https://github.com/pcroland/deew) 开源项目提供了 Blu-ray 流程核心能力。
- [deezy](https://github.com/jessielw/DeeZy) 提供 Atmos Blu-ray 封装辅助。
- ffmpeg 项目提供 MP4 重封装能力。

---

> MIT License · Feel free to fork, tweak, and contribute improvements. Pull requests and issue reports are welcome! 🎧
