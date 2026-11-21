#!/usr/bin/env bash
# 手机本地：在 Termux / Ubuntu 里启动 GPT-SoVITS + 克隆服务（只监听 127.0.0.1）
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
GPT_DIR="${1:-$ROOT/../GPT-SoVITS}"
if [ ! -f "$GPT_DIR/api_v2.py" ]; then
  echo "找不到 $GPT_DIR/api_v2.py"
  echo "用法: ./start_phone.sh /path/to/GPT-SoVITS"
  exit 1
fi
PY="$GPT_DIR/runtime/python3"
[ -x "$PY" ] || PY="python3"
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "提示: 未安装 ffmpeg，只能上传 wav。Termux: pkg install ffmpeg"
fi
echo "手机本地 GPT-SoVITS：$GPT_DIR"
echo "启动 API（127.0.0.1:9880）..."
"$PY" "$GPT_DIR/api_v2.py" -a 127.0.0.1 -p 9880 > "$ROOT/phone_gpt.log" 2>&1 &
GPT_PID=$!
trap 'kill $GPT_PID 2>/dev/null || true' EXIT
sleep 10
echo "启动克隆服务（127.0.0.1:9881）..."
python3 "$ROOT/clone_server.py" --host 127.0.0.1 --port 9881 --gpt http://127.0.0.1:9880 --data "$ROOT/voices"
RC=$?
kill $GPT_PID 2>/dev/null || true
exit $RC
