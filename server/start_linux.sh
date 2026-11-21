#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
GPT_DIR="${1:-$ROOT/../GPT-SoVITS}"
if [ ! -f "$GPT_DIR/api_v2.py" ]; then
  echo "找不到 $GPT_DIR/api_v2.py"
  echo "用法: ./start_linux.sh /path/to/GPT-SoVITS"
  exit 1
fi
PY="$GPT_DIR/runtime/python3"
[ -x "$PY" ] || PY="python3"
echo "GPT-SoVITS : $GPT_DIR"
echo "Python     : $PY"
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "提示: 未安装 ffmpeg，只能上传 wav。可执行: sudo apt install ffmpeg"
fi
echo "启动 GPT-SoVITS API ..."
"$PY" "$GPT_DIR/api_v2.py" -a 127.0.0.1 -p 9880 > "$ROOT/gpt_sovits.log" 2>&1 &
GPT_PID=$!
echo $GPT_PID > "$ROOT/gpt_sovits.pid"
trap 'kill $GPT_PID 2>/dev/null || true' EXIT
sleep 10
python3 "$ROOT/clone_server.py" --host 0.0.0.0 --port 9881 --gpt http://127.0.0.1:9880 --data "$ROOT/voices"
RC=$?
kill $GPT_PID 2>/dev/null || true
exit $RC
