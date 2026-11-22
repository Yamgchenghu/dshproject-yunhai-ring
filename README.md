# 云海转盘 v0.2.8.9

一个本地离线的抽奖转盘 Android App，支持导入 `.pwh`、分类、排序、避重、权重、自动跳转，以及 **系统 TTS / GPT-SoVITS 音色克隆** 朗读结果。

- APK：`dist/云海转盘-v0.2.8.9.apk`（约 0.2 MB，可导入自定义字体）
- 服务器包：`server/`（打包为 `site/downloads/wheel-clone-server.zip`）
- 下载页源码：`site/`（可部署到 Cloudflare Pages）

## 安装

1. 把 `云海转盘-v0.2.8.9.apk` 传到手机并点开。
2. 如果系统提示，允许「安装未知应用」。
3. 桌面名称：**云海转盘**。

APK 使用本地调试证书签名，适合自用；如需上架应用商店请更换签名。

## 功能

- **导入 .pwh**：自动去掉前缀（如 `pwh`），支持 gzip / zip / 纯 JSON，zip 里会自动找 `.json`。示例文件 604 个转盘 / 3618 个选项可直接导入。
- **避重组**：仅避重模式开启时显示；关闭避重后该条目不显示，组设置保留。
- **避重组**：每个选项可设自然数组号（0 = 永不避重），同组抽完下一次抽奖自动复原；高级页可一键重置。
- **避重**：每个转盘单独开关，抽过的选项变灰、不再参与，显示「剩余 N 项」；抽完后可按设置延时自动复原（默认 3 秒，`_reset` 可调，0 = 不自动）。
- **权重**：每个选项独立权重，默认 100。
- **大量转盘**：列表分页（首屏 60 个）、搜索、分类筛选；支持 600+ 转盘。
- **分类 / 排序**：新建、改名、排序、删除；手动上移下移、按名称 / 数量 / 时间排序。
- **自动跳转**：抽到某选项 → 等待（数字，或 `{rf}+2.5` 等朗读结束后再加 2.5 秒）→ 跳转目标转盘（可选自动旋转）；选项和目标转盘都支持搜索，目标可按分类筛选。
- **朗读（三种）**：① Android 系统 TTS；② GPT-SoVITS 电脑服务器；③ GPT-SoVITS 手机本地。后两种各保存一套音色，互不冲突。
- **音色克隆**：设置 → 音色克隆，可选「电脑服务器 / 手机本地 / 直连 API」；上传 3–10 秒参考音频和参考文本，支持多音色、试听、删除、失败回退系统 TTS。
- **字体**：默认系统字体；支持从 sdcard 导入自己的 `.ttf / .otf / .woff`，可只用于转盘/结果或整个界面。字体只保存在本机。
- **导出/导入**：导出弹窗支持「全部 / 指定转盘组」，格式有仅数据 JSON、仅数据 PWH（大转盘小决定可读）、完整版 ZIP 2.0（含跳转、脚本、避重组、数据和权重）；导入支持这三种文件。
- **AI 翻译器**：只做话风改写，不回答/不拒绝/不给代码；检测到模型在回答内容时自动回退本地话风。
- **AI 翻译器**：小游戏入口里，8 种话风（千问/GLM/Grok/Kimi/Claude/Gemini/DeepSeek/ChatGPT），支持本地改写或接 8 家 LLM API；输入最多 1200 字，13 条示例作为前置 prompt。
- **小游戏入口**：首页设置按钮右侧的游戏手柄按钮，里面包含指尖轮盘和摇骰子。
- **指尖轮盘**：多指按住屏幕，保持不动 5 秒后随机选择 5 秒，最终固定一只手指；松手取消，最多到设备触控上限（App 内上限 10 指）。
- **摇骰子**：支持 1–20 个骰子，类型有硬币（2 面）、6 / 10 / 12 / 20 面。
- **抽取记录**：自动记录每次结果（时间、转盘、选项），可按转盘筛选、清空。
- **脚本 ring 引用**：`r = ring` 保存当前转盘引用，`goto` 后 `ring` 切换但 `r` 仍指旧转盘；每个访问过的转盘存为 `ring_转盘名`。
- **脚本设置作用域**：脚本里改的 `_autogoto`、`_reset`、`ring.autogoto`、`ring.unique`、`ring.unable` 只在本次运行有效，结束后恢复原设置。
- **自动脚本（全局）**：设置 → 自动脚本，全 App 只有一份脚本；访问 `ring` 或调用 `run()` 前必须先 `goto("转盘名")`；脚本内对转盘、设置、抽奖记录、脚本变量的修改在结束后全部回退，完全无痕。支持 goto/run/ring.unique/ring.reset/ring.unable/ring.enable/ring.set/ring.index/show/help、`def` 函数、`try/except/finally`（参数、默认参数、关键字参数、return）；`ring` 指当前转盘；变量与选项统计可查看、清空。变量名/函数名支持中文，不能占用内置名。
- **Python 兼容**：新增 `raise`、`Exception/ValueError`、`sum/max/min/sorted/round/enumerate/zip`，切片、list、range(list)，循环上限提高。
- **list / 切片**：`list(x)` 复制列表或拆字符串；`a[start:end:step]` 切片；`range(列表)` 返回下标 0..长度-1。
- **字符串方法**：`s.split()` / `s.split(sep)` / `s.split(sep, maxsplit)`，另有 strip、replace、join 等。
- **列表方法**：脚本支持 `list.append` / `list.pop` / `list.remove` / `list.index`（含负索引、start/end）。
- **脚本扩展**：`import time`（sleep/时间）、`import turtle`（在应用界面上画图）、`import random`（随机数）、`import requests`/`import request`（HTTP）、`import tkinter as tk`（应用内新窗口）；`print()` 底部提示 2 秒，`input()` 全屏输入，必须确认后继续（不可取消）。
- **大整数显示**：整数超过 2,147,483,647（21.47 亿）时，用 8 位有效数字的科学计数法显示；内部仍是浮点数。
- **内置参考音色**：自定义 API 音色克隆内置 Claude sonnet 5.5 和 GPT6.1sol 两段参考音频（96kbps 单声道 MP3，约 197 KB），可直接选用。
- **数字读法**：系统语言为中文时，TTS 请求里的阿拉伯数字先转中文（1.5→一点五，2026→二千零二十六），避免默认读成英文。
- **TTS 缓存策略**：API TTS、音色克隆、音色生成、GPT-SoVITS 缓存永久保存，可删除/重新生成/导出；系统 TTS 缓存保留 30 天，可删除/替换，不提供重新生成或导出。
- **本地 TTS 文件**：设置 → 数据 → 本地 TTS 文件，可试听、替换、删除；按类型提供重新生成/导出。
- **打印弹幕**：`print()` 在底部叠加显示，最多同时 5 条；更多的进入缓存队列，等前面的 2 秒结束后依次展示。
- **系统 TTS 缓存**：支持全文和分段缓存，30 天未用清理。
- **脚本编辑器**：自动缩进；函数名/括号层级/字符串/整数/浮点/关键字分色高亮；支持中文括号、引号、逗号、冒号自动转译；`try/except/else/finally`。
- **脚本帮助**：`help()` 弹窗支持 ring / Python / turtle / time / random / request / tkinter 分页；`ring` 是内置的，不需要 `from randomring import *`。
- **脚本绘图**：`show("...", x, y)` 支持 `<RET 填充 边框宽 边框色 圆角>文字</RET>`、`<CIR 填充 边框宽 边框色>文字</CIR>`（参数同 RET 前三个，圆角固定半宽）、`<color rgba>文字</color>`，返回句柄可 `change_str / invisible / visible / delete`；变量变化时自动刷新。

## 音色克隆怎么用

GPT-SoVITS 需要一台电脑运行（模型数 GB，不能塞进 APK）。手机 App 是客户端。

1. 电脑安装官方 GPT-SoVITS（整合包或源码），确认有 `api_v2.py`。
2. 下载 `server/` 打包的克隆服务包，放到 GPT-SoVITS 旁边，运行 `start_windows.bat` / `start_linux.sh`。脚本会同时启动 GPT-SoVITS（9880）和克隆服务（9881）。
3. App → 设置 → 音色克隆：
   - 连接方式选「电脑服务器」
   - 地址填 `http://电脑IP:9881`
   - 测试连接
   - 添加音色：选参考音频（可从 sdcard 根目录选）、填参考文本、上传
4. 回到设置打开「朗读」，引擎选 GPT-SoVITS；抽中结果会自动用克隆音色朗读。

> 手机和电脑需在同一局域网；Windows 防火墙要放行；建议服务器安装 ffmpeg（`winget install Gyan.FFmpeg` / `sudo apt install ffmpeg`），否则只能上传 wav。

也支持「直连 API」模式：直接连接官方 `api_v2.py`（9880），参考音频填**服务器上的路径**，适合不想跑克隆服务的用户。

## 朗读模板变量

- `{result}`：抽到的结果
- `{count}`：已抽次数（非避重模式从进入该转盘开始计数；避重模式按已抽掉的项数）
- `{last}`：剩余数量（避重模式为剩余未抽项；非避重模式为总项数减本次进入后的已抽次数）
- `{time}`：当前时间，UTC+8，格式 `yyyy年mm月dd日hh时mm分`
- 脚本里的 `get_location()`：返回 GPS/北斗等 GNSS 定位所属城市；需要定位权限，失败返回 `None`。优先系统 Geocoder，失败时用 OpenStreetMap 反查（只发送坐标）。

设置页只显示变量名，不显示括号说明；点「结果 / 次数 / 剩余 / 时间」可直接插入。

## 手机本地 GPT-SoVITS（实验）

App 里已经保留「手机本地」模式，地址固定 `http://127.0.0.1:9881`，音色列表与电脑端分开。

- 手机需要 Termux 或 Ubuntu 环境，安装 GPT-SoVITS + 模型，再运行服务包里的 `start_phone.sh`。
- 这台手机当前只有约 4.9GB 空闲存储、约 1.2GB 可用内存且 swap 已满，**没有实际安装运行 GPT-SoVITS**；强行装 PyTorch 版很可能 OOM。建议先腾空间/关闭后台应用，或换成 ONNX Runtime 的 GPT-SoVITS 移植。
- 手机没有 GPU，CPU 合成一句可能要几十秒；这是「有本地备选」而不是「和电脑一样快」。
- 服务没启动时，App 测试连接会失败并自动回退系统 TTS。

## 性能与内存

- 首页只渲染前 60 个转盘，按需「加载更多」，避免 600+ 卡片同时进 DOM。
- 转盘绘制到离屏画布缓存，旋转时只做位图旋转；实测 44 项 120 帧约 30ms，322 项约 9ms。
- 自定义字体用 `FontFace` 加载，替换时删除旧字面；DPR 上限 2.5。
- 保存防抖 300ms；启动时清理 2 天前的 TTS 缓存音频。
- 参考音频只保留一份本地副本；音色列表不把音频塞进数据库。

## 字体

App 不再内置字体，默认使用系统字体。用户导入的字体仅保存在本机；请自行确认字体授权。

## 构建

无需 Gradle，使用本机 aapt2 / javac / d8 / apksigner：

```bash
cd /root/workspace/wheel-app
./build.sh
```

产物：`dist/云海转盘-v0.2.8.9.apk`

- `web/`：HTML/CSS/JS 界面
- `android/`：WebView 外壳、TTS、文件选择、字体/音频上传、持久化
- `server/`：Python 标准库克隆服务
- `site/`：Cloudflare Pages 静态下载页
- `tools/`：构建、对齐、测试脚本

## Cloudflare 页面

`site/` 已经可以直接上传到 Cloudflare Pages，目标域名 `gptsovit.rainstone103.top`。具体步骤见 `site/README.md`。
