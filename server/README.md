# 云海转盘 · GPT-SoVITS 克隆服务包

这是配合「云海转盘」App 使用的小型服务端。它不包含 GPT-SoVITS 模型，只负责：

- 接收手机上传的参考音频（`/voices`）
- 把 `/tts` 转发给本机 GPT-SoVITS `api_v2.py`
- 提供健康检查、音色列表、删除音色

只用 Python 3 标准库，**不需要 pip 安装任何东西**。

## 1. 准备

- 一台电脑或服务器（Windows / Linux / macOS 都可以）
- 已经安装好的 GPT-SoVITS（推荐官方整合包，里面带 `api_v2.py` 和 `runtime\python.exe`）
- 强烈建议安装 **ffmpeg** 并加入 PATH（否则只能上传 wav）：
  - Windows：`winget install Gyan.FFmpeg`，或从 ffmpeg.org 下载后把 `bin` 加进 PATH
  - Ubuntu/Debian：`sudo apt install ffmpeg`
- Python 3.8+（整合包自带 runtime 的话可以不用另装）

## 2. 启动

把本文件夹放在 GPT-SoVITS 目录旁边，然后：

### Windows

双击 `start_windows.bat`。脚本会自动找到 `..\GPT-SoVITS\api_v2.py`，启动 GPT-SoVITS（9880），再启动克隆服务（9881）。

如果 GPT-SoVITS 在别的位置：

```bat
start_windows.bat -GptDir "D:\GPT-SoVITS"
```

或者直接运行 PowerShell：

```powershell
powershell -ExecutionPolicy Bypass -File start_windows.ps1 -GptDir "D:\GPT-SoVITS"
```

### Linux / macOS

```bash
./start_linux.sh /path/to/GPT-SoVITS
```

### 手动启动（最稳妥）

先启动 GPT-SoVITS：

```bash
python api_v2.py -a 127.0.0.1 -p 9880
```

再启动本服务：

```bash
python3 clone_server.py --host 0.0.0.0 --port 9881 --gpt http://127.0.0.1:9880
```

## 3. 手机连接

启动后终端会打印：

```
手机访问   : http://192.168.1.23:9881
```

把这一串填到 App：**设置 → 音色克隆 → 克隆服务器地址**，点「测试服务器连接」。

- 手机和电脑必须同一局域网。
- Windows 第一次启动可能弹出防火墙提示，选「允许访问」。
- 如果连不上：检查 IP、端口、防火墙，以及 GPT-SoVITS 是否在 9880 正常运行。

## 4. 加访问密钥（可选）

```bash
python3 clone_server.py --api-key 你的密钥
```

App 里填同一个密钥。局域网自用可不设。

## 5. 参考音频建议

- 3～10 秒、单人、无背景音乐
- 参考文本必须和录音内容一致
- 格式建议 wav / mp3 / m4a（需要 ffmpeg）
- 上传后自动转成 32k 单声道 wav，最长截取 15 秒

## 6. API

- `GET /health` → `{ok, gpt_sovits, voices, ffmpeg}`
- `POST /voices`（multipart：`audio`, `name`, `prompt_text`, `prompt_lang`, `text_lang`）
- `GET /voices`
- `DELETE /voices/{id}`
- `GET /tts?text=...&voice_id=...&speed_factor=1.0` → wav
- 设置密钥后，所有请求带 `X-API-Key`。

## 7. 注意

- 克隆服务和 GPT-SoVITS 必须在**同一台机器 / 同一文件系统**上，因为 GPT-SoVITS 需要读取 `voices/xxx.wav` 的绝对路径。
- 本服务只适合局域网/内网自用；暴露公网请加反向代理、HTTPS 和强密钥。
- GPT-SoVITS 模型、整合包请从官方仓库下载：https://github.com/RVC-Boss/GPT-SoVITS/releases


## 8. 手机本地（Termux / Ubuntu，实验）

App 支持「手机本地」模式，地址固定为 `http://127.0.0.1:9881`。需要手机里有一个 Linux 环境：

1. 安装 Termux（F-Droid 版）或使用本机 Ubuntu/proot。
2. 在环境里安装 GPT-SoVITS（官方整合包或源码 + 模型）和 ffmpeg。
3. 把本服务包放进去，运行：

```bash
./start_phone.sh /path/to/GPT-SoVITS
```

4. App → 设置 → 音色克隆 → 手机本地，地址保持 `http://127.0.0.1:9881`，测试连接。

注意：

- 手机没有 GPU，GPT-SoVITS CPU 合成一句可能要几十秒；内存/存储不足会失败。
- 需要保持 Termux/Ubuntu 后台运行；关闭后 App 就连不上。
- 如果手机跑不动 PyTorch 版，可以关注基于 ONNX Runtime 的 GPT-SoVITS 移植项目（如 gpt-sovits-onnx-rs），但要自行编译和转换模型。
