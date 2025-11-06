# Dolby Encoding Engine GUI

[![release](https://img.shields.io/badge/release-v1.0-blue.svg)](./dist_electron)
[![electron](https://img.shields.io/badge/electron-13.0-47848F.svg)](https://www.electronjs.org/)
[![vue](https://img.shields.io/badge/vue-3.2-41B883.svg)](https://vuejs.org/)
[![python](https://img.shields.io/badge/python-3.9+-3776AB.svg)](https://www.python.org/)
[![license](https://img.shields.io/badge/license-MIT-ff69b4.svg)](./LICENSE)

A tidy Electron + Vue 3 desktop companion that wraps `encode.exe`, orchestrates Dolby `dee.exe`, and now extends the workflow with **deew** and **ffmpeg** to deliver 7.1ch Dolby Digital Plus (Blu-ray) assets from ADM BWF inputs.

---

## 🔍 At a Glance

| Capability | Details |
| --- | --- |
| Supported inputs | ADM BWF (Atmos mixes) |
| Output workflows | Atmos EC3 · Atmos M4A · Atmos TrueHD (MLP) · Dolby Digital Plus 7.1 for Blu-ray |
| OS target | Windows (Electron build) |
| Core engine | Dolby Encoding Engine 5.x (`dee.exe`) |
| Extra tooling | `deew` Python package · `ffmpeg` for final mux |
| Languages | English · 中文 |

---

## ✨ Key Features

- Real-time log streaming and progress bar synced with `dee.exe` output.
- Settings dialog to persist the Dolby engine root (`dee.exe` + `xml_templates`).
- Parameter persistence (`last_params.txt`) to restore the latest successful encode.
- Post-processing pipeline for Blu-ray: run `deew` → clean intermediates → remux with `ffmpeg` → final `.m4a`.
- Bilingual UI toggle (English / 中文) plus quick keyboard shortcuts.

---

## 📦 Requirements

- **Node.js 16+** and npm for development / packaging.
- **Python 3.9+** accessible via `python` or `py` on PATH (used to launch `deew`).
- **deew** – install with `pip install deew`.
- **ffmpeg** – ensure the binary is present on PATH.
- **Dolby Encoding Engine** (DEE 5.1–5.2). Keep its `dee.exe`, `xml_templates/`, `DolbyTemp/` folders intact.

> 📝 `encode.exe` ships with the project. Rebuild it only when you change `encode.c` or need a custom toolchain.

---

## 🚀 Quick Start (English)

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

During the Blu-ray profile, the UI holds at 99% with a "converting" toast while `deew` and `ffmpeg` finish. When everything succeeds you’ll see `Encoding finished, exit code: 0` and the progress bar snaps to 100%.

---

## ⚙️ Configuration Tips

- **Engine Directory** – stored in Electron user-data. Change it via Settings without editing env vars.
- **Language menu** – `Ctrl/Cmd+Shift+E` (English) · `Ctrl/Cmd+Shift+C` (中文).
- **Paths** – avoid double quotes in file paths; the UI guards against illegal characters.
- **Temp cleanup** – Blu-ray workflow removes intermediate `.mlp/.eb3/.mll/.log` files automatically.

---

## 🧪 Troubleshooting

- Progress stuck at 0% ➜ check `dee.exe` logs still emit `Overall progress:` lines.
- `deew` cannot find the input ➜ ensure Python 3.9+ is first on PATH and the app switches to the MLP directory automatically.
- `ffmpeg` header error ➜ confirm you’re using a build that supports `-c:a copy` with E-AC-3 inside MP4 (`ffmpeg` 5.x/6.x works).
- Need a fresh start ➜ delete `last_params.txt` in the project root.

---

## 🤝 Credits

- Dolby Encoding Engine (commercial software) for the core transcodes.
- [deew](https://github.com/pcroland/deew) for the open-source wrapper enabling the Blu-ray Dolby Digital Plus pipeline.
- ffmpeg project for the MP4 remuxing stage.

---

# Dolby Encoding Engine GUI · 中文说明

## ✨ 功能亮点

- 实时跟踪 `dee.exe` 日志及进度条。
- 设置窗体可持久化保存 Dolby 引擎根目录。
- `last_params.txt` 自动记录最近一次成功参数。
- Blu-ray 流程自动调用 `deew` → 清理中间文件 → `ffmpeg` 重新封装为 `.m4a`。
- 支持中英文界面，一键切换。

## 📦 环境依赖

- **Node.js 16+** 与 npm。
- **Python 3.9+**（须保证 `python`/`py` 命令可用）。
- **deew**（`pip install deew`）。
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

Blu-ray 流程中，进度条会在 99% 停留并提示“正在转换…”，待 `deew` 与 `ffmpeg` 完成后才显示 100%。

## ⚙️ 配置说明

- **dee 目录** 通过设置界面修改，无需手动编辑配置文件。
- **语言切换** 快捷键：`Ctrl/Cmd+Shift+E`（英文）、`Ctrl/Cmd+Shift+C`（中文）。
- **路径合法性**：UI 会校验双引号等非法字符，避免编解码失败。
- **临时文件**：Blu-ray 流程结束后会自动删除 `.mlp/.eb3/.mll/.log` 等中间文件。

## 🧪 常见问题

- 进度条停在 0% ➜ 确认 `dee.exe` 日志仍输出 `Overall progress:`。
- `deew` 找不到输入文件 ➜ 确认 Python 3.9+ 在 PATH 且应用会切换至 MLP 输出目录。
- `ffmpeg` 报头部错误 ➜ 使用支持 E-AC-3 copy 的 `ffmpeg` 版本，并保持 Blu-ray 模式产生的 `.eb3` 在同一目录。
- 重置参数 ➜ 删除项目根目录下的 `last_params.txt`。

## 🤝 鸣谢

- Dolby Encoding Engine（商业软件）。
- [deew](https://github.com/pcroland/deew) 开源项目提供了 Blu-ray 流程核心能力。
- ffmpeg 项目提供 MP4 重封装能力。

---

> MIT License · Feel free to fork, tweak, and contribute improvements. Pull requests and issue reports are welcome! 🎧
