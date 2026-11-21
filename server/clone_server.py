#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
云海转盘 · GPT-SoVITS 克隆服务器
只用 Python 标准库，无需 pip 安装依赖。

它做三件事：
  1. 接收手机上传的参考音频，保存到 voices/
  2. 把 /tts 请求转发给本机 GPT-SoVITS api_v2.py，并带上对应的参考音频路径
  3. 提供 /health 和音色列表/删除接口

启动：
  python clone_server.py --gpt http://127.0.0.1:9880 --port 9881
"""

import argparse
import hmac
import json
import mimetypes
import os
import re
import secrets
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ARGS = None
DATA_DIR = None
META_FILE = None
LOCK = threading.Lock()
MAX_BODY = 60 * 1024 * 1024


def log(*a):
    print(*a, flush=True)


def load_meta():
    with LOCK:
        try:
            with open(META_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}


def save_meta(meta):
    with LOCK:
        tmp = str(META_FILE) + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=1)
        os.replace(tmp, META_FILE)


def gpt_base():
    b = ARGS.gpt.strip().rstrip("/")
    if b.endswith("/tts"):
        b = b[:-4]
    return b


def gpt_online():
    try:
        urllib.request.urlopen(gpt_base() + "/", timeout=2)
        return True
    except urllib.error.HTTPError:
        return True
    except Exception:
        return False


def ext_ok(name):
    return (Path(name).suffix or "").lower()


def ffmpeg_available():
    return shutil.which("ffmpeg") is not None


def ffprobe_duration(path):
    if not shutil.which("ffprobe"):
        return None
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=nw=1:nk=1", str(path)],
            capture_output=True, text=True, timeout=15)
        return float(out.stdout.strip())
    except Exception:
        return None


def prepare_audio(raw, original_name, dest):
    """把上传音频转成 32k 单声道 wav；没有 ffmpeg 时只接受 wav。"""
    suffix = ext_ok(original_name) or ".bin"
    tmp = DATA_DIR / ("tmp_" + uuid.uuid4().hex + suffix)
    tmp.write_bytes(raw)
    try:
        if shutil.which("ffmpeg"):
            cmd = ["ffmpeg", "-y", "-i", str(tmp), "-ac", "1", "-ar", "32000",
                   "-t", "15", "-f", "wav", str(dest)]
            p = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
            if p.returncode != 0:
                tail = (p.stderr or "")[-300:]
                raise RuntimeError("音频转换失败：" + tail)
            return ffprobe_duration(dest)
        if suffix == ".wav":
            shutil.copyfile(tmp, dest)
            return ffprobe_duration(dest)
        raise RuntimeError("服务器没有安装 ffmpeg，只能上传 wav；请安装 ffmpeg 或先用工具转成 wav")
    finally:
        try:
            tmp.unlink()
        except Exception:
            pass


def parse_multipart(body, boundary):
    """极简 multipart 解析，返回 {name: {'filename':..., 'data': bytes}}"""
    delim = b"--" + boundary.encode("latin-1")
    out = {}
    for part in body.split(delim)[1:]:
        if part.startswith(b"--"):
            break
        if part.startswith(b"\r\n"):
            part = part[2:]
        if part.endswith(b"\r\n"):
            part = part[:-2]
        head, sep, data = part.partition(b"\r\n\r\n")
        if not sep:
            continue
        if data.endswith(b"\r\n"):
            data = data[:-2]
        headers = {}
        for line in head.split(b"\r\n"):
            try:
                k, v = line.decode("utf-8", "replace").split(":", 1)
                headers[k.strip().lower()] = v.strip()
            except ValueError:
                pass
        disp = headers.get("content-disposition", "")
        m = re.search(r'name="([^"]*)"', disp)
        if not m:
            continue
        name = m.group(1)
        fm = re.search(r'filename="([^"]*)"', disp)
        out[name] = {
            "filename": fm.group(1) if fm else "",
            "content_type": headers.get("content-type", ""),
            "data": data,
        }
    return out


def clean_id(v):
    return re.sub(r"[^a-zA-Z0-9_-]", "", v or "")[:64]


class Handler(BaseHTTPRequestHandler):
    server_version = "WheelClone/1.0"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    # ---------- helpers ----------
    def cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-API-Key")
        self.send_header("Access-Control-Max-Age", "86400")

    def send_json(self, code, obj):
        data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.cors()
        self.end_headers()
        self.wfile.write(data)

    def send_bytes(self, code, data, ctype):
        self.send_response(code)
        self.send_header("Content-Type", ctype or "application/octet-stream")
        self.send_header("Content-Length", str(len(data)))
        self.cors()
        self.end_headers()
        self.wfile.write(data)

    def authorized(self):
        if not ARGS.api_key:
            return True
        got = self.headers.get("X-API-Key", "")
        return hmac.compare_digest(got, ARGS.api_key)

    def need_auth(self):
        if self.authorized():
            return True
        self.send_json(401, {"message": "访问密钥不正确"})
        return False

    # ---------- OPTIONS ----------
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Content-Length", "0")
        self.cors()
        self.end_headers()

    # ---------- GET ----------
    def do_GET(self):
        if not self.need_auth():
            return
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        qs = urllib.parse.parse_qs(parsed.query)
        try:
            if path == "/health":
                meta = load_meta()
                self.send_json(200, {
                    "ok": True,
                    "gpt_sovits": "up" if gpt_online() else "down",
                    "voices": len(meta),
                    "ffmpeg": ffmpeg_available(),
                    "version": "1.0",
                })
                return
            if path == "/voices":
                meta = load_meta()
                arr = []
                for vid, m in meta.items():
                    arr.append({
                        "id": vid,
                        "name": m.get("name", ""),
                        "prompt_text": m.get("prompt_text", ""),
                        "prompt_lang": m.get("prompt_lang", "zh"),
                        "text_lang": m.get("text_lang", "zh"),
                        "created_at": m.get("created_at", 0),
                        "size": m.get("size", 0),
                    })
                arr.sort(key=lambda x: x.get("created_at", 0))
                self.send_json(200, {"voices": arr})
                return
            if path.startswith("/voices/") and path.endswith("/audio"):
                vid = clean_id(path[len("/voices/"):-len("/audio")].strip("/"))
                meta = load_meta()
                if vid not in meta:
                    self.send_json(404, {"message": "音色不存在"})
                    return
                f = DATA_DIR / (vid + ".wav")
                if not f.is_file():
                    self.send_json(404, {"message": "音频文件不存在"})
                    return
                self.send_bytes(200, f.read_bytes(), "audio/wav")
                return
            if path == "/tts":
                self.handle_tts(qs)
                return
            self.send_json(404, {"message": "not found"})
        except Exception as e:
            self.send_json(500, {"message": str(e)})

    def handle_tts(self, qs):
        def one(k, default=""):
            return (qs.get(k) or [default])[0]

        text = one("text").strip()
        if not text:
            self.send_json(400, {"message": "text 不能为空"})
            return
        vid = clean_id(one("voice_id"))
        meta = load_meta()
        voice = meta.get(vid)
        if not voice:
            self.send_json(404, {"message": "音色不存在，请重新上传"})
            return
        ref = DATA_DIR / (vid + ".wav")
        if not ref.is_file():
            self.send_json(404, {"message": "参考音频丢失，请重新上传"})
            return
        try:
            speed = max(0.5, min(2.0, float(one("speed_factor", "1") or 1)))
        except Exception:
            speed = 1.0
        text_lang = one("text_lang") or voice.get("text_lang", "zh")
        split = one("text_split_method") or "cut5"
        params = {
            "text": text,
            "text_lang": text_lang,
            "ref_audio_path": str(ref.resolve()),
            "prompt_text": voice.get("prompt_text", ""),
            "prompt_lang": voice.get("prompt_lang", "zh"),
            "text_split_method": split,
            "media_type": "wav",
            "streaming_mode": "false",
            "speed_factor": str(speed),
        }
        url = gpt_base() + "/tts?" + urllib.parse.urlencode(params)
        req = urllib.request.Request(url, headers={"Accept": "audio/wav,audio/*"})
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                data = r.read()
                ctype = r.headers.get("Content-Type", "audio/wav")
            if not data:
                raise RuntimeError("GPT-SoVITS 返回了空音频")
            if "application/json" in (ctype or "").lower():
                try:
                    j = json.loads(data.decode("utf-8", "replace"))
                    msg = j.get("message") or j.get("detail") or data.decode("utf-8", "replace")
                except Exception:
                    msg = data.decode("utf-8", "replace")
                self.send_json(502, {"message": "GPT-SoVITS 出错：" + str(msg)[:300]})
                return
            self.send_bytes(200, data, ctype)
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")
            msg = body
            try:
                j = json.loads(body)
                msg = j.get("message") or j.get("detail") or body
            except Exception:
                pass
            self.send_json(502, {"message": "GPT-SoVITS 出错：" + str(msg)[:300]})
        except Exception as e:
            self.send_json(502, {"message": "无法连接 GPT-SoVITS：" + str(e)})

    # ---------- POST ----------
    def do_POST(self):
        if not self.need_auth():
            return
        path = urllib.parse.urlparse(self.path).path
        if path != "/voices":
            self.send_json(404, {"message": "not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY:
                self.send_json(413, {"message": "上传内容为空或过大（上限 60MB）"})
                return
            ctype = self.headers.get("Content-Type", "")
            m = re.search(r"boundary=([^;]+)", ctype)
            if not m:
                self.send_json(400, {"message": "需要 multipart/form-data"})
                return
            boundary = m.group(1).strip().strip('"')
            body = self.rfile.read(length)
            fields = parse_multipart(body, boundary)
            audio = fields.get("audio")
            if not audio or not audio.get("data"):
                self.send_json(400, {"message": "缺少 audio 文件"})
                return
            name = (fields.get("name", {}).get("data", b"").decode("utf-8", "replace") or "我的音色").strip()[:40]
            prompt_text = fields.get("prompt_text", {}).get("data", b"").decode("utf-8", "replace").strip()
            prompt_lang = (fields.get("prompt_lang", {}).get("data", b"zh").decode("utf-8", "replace") or "zh").strip()
            text_lang = (fields.get("text_lang", {}).get("data", b"zh").decode("utf-8", "replace") or "zh").strip()
            if prompt_lang not in ("zh", "en", "ja", "ko"):
                prompt_lang = "zh"
            if text_lang not in ("zh", "en", "ja", "ko"):
                text_lang = "zh"
            if not prompt_text:
                self.send_json(400, {"message": "参考文本不能为空（录音里说的那句话）"})
                return
            vid = uuid.uuid4().hex[:12]
            dest = DATA_DIR / (vid + ".wav")
            duration = prepare_audio(audio["data"], audio.get("filename") or "ref.wav", dest)
            if duration is not None and duration < 0.4:
                try:
                    dest.unlink()
                except Exception:
                    pass
                self.send_json(400, {"message": "参考音频太短，请上传 3～10 秒"})
                return
            meta = load_meta()
            meta[vid] = {
                "id": vid,
                "name": name,
                "prompt_text": prompt_text,
                "prompt_lang": prompt_lang,
                "text_lang": text_lang,
                "original_name": audio.get("filename", ""),
                "size": dest.stat().st_size,
                "duration": duration,
                "created_at": int(time.time() * 1000),
            }
            save_meta(meta)
            log("上传音色:", vid, name, "duration=", duration, "size=", dest.stat().st_size)
            self.send_json(200, {
                "id": vid,
                "name": name,
                "path": str(dest.resolve()),
                "prompt_text": prompt_text,
                "prompt_lang": prompt_lang,
                "text_lang": text_lang,
                "duration": duration,
            })
        except Exception as e:
            self.send_json(500, {"message": str(e)})

    # ---------- DELETE ----------
    def do_DELETE(self):
        if not self.need_auth():
            return
        path = urllib.parse.urlparse(self.path).path
        if not path.startswith("/voices/"):
            self.send_json(404, {"message": "not found"})
            return
        vid = clean_id(path[len("/voices/"):])
        meta = load_meta()
        if vid not in meta:
            self.send_json(404, {"message": "音色不存在"})
            return
        try:
            (DATA_DIR / (vid + ".wav")).unlink()
        except Exception:
            pass
        meta.pop(vid, None)
        save_meta(meta)
        log("删除音色:", vid)
        self.send_json(200, {"ok": True, "id": vid})


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


def main():
    global ARGS, DATA_DIR, META_FILE
    p = argparse.ArgumentParser(description="Wheel GPT-SoVITS clone server")
    p.add_argument("--host", default="0.0.0.0")
    p.add_argument("--port", type=int, default=9881)
    p.add_argument("--gpt", default="http://127.0.0.1:9880", help="GPT-SoVITS api_v2 base URL")
    p.add_argument("--data", default="./voices", help="voice storage directory")
    p.add_argument("--api-key", default=os.environ.get("CLONE_API_KEY", ""),
                   help="optional X-API-Key required from clients")
    ARGS = p.parse_args()
    DATA_DIR = Path(ARGS.data).resolve()
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    META_FILE = DATA_DIR / "voices.json"
    if not META_FILE.exists():
        META_FILE.write_text("{}", encoding="utf-8")

    print("=" * 56)
    print(" 云海转盘 · GPT-SoVITS 克隆服务器")
    print("=" * 56)
    print(" GPT-SoVITS :", gpt_base(), "(在线)" if gpt_online() else "(暂时连不上，稍后自动重试)")
    print(" 本机监听   : http://%s:%d" % (ARGS.host, ARGS.port))
    print(" 手机访问   : http://%s:%d" % (lan_ip(), ARGS.port))
    print(" 音色目录   :", DATA_DIR)
    print(" API Key    :", "已设置" if ARGS.api_key else "未设置（局域网可直接访问）")
    print(" ffmpeg     :", "已安装" if ffmpeg_available() else "未安装（只能上传 wav）")
    print("=" * 56)
    print(" App 设置 → 音色克隆 → 填上面的「手机访问」地址")
    print(" 按 Ctrl+C 停止")
    print("=" * 56)
    server = ThreadingHTTPServer((ARGS.host, ARGS.port), Handler)
    server.daemon_threads = True
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
