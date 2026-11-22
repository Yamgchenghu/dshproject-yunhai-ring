#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
SDK="${ANDROID_SDK:-/root/android}"
BT="$SDK/bt/android-14"
JAR="$SDK/platform/android-34-ext12/android.jar"
AAPT2="/usr/bin/aapt2"
KEYSTORE="$ROOT/tools/wheel.keystore"

cd "$ROOT"
rm -rf build dist
mkdir -p build/gen build/classes build/dex dist

echo "==> compile resources"
(cd android && "$AAPT2" compile --dir res -o ../build/res.zip)

echo "==> link resources + assets"
(cd android && "$AAPT2" link -o ../build/app.apk -I "$JAR" \
  --manifest AndroidManifest.xml -A "$ROOT/web" --java ../build/gen ../build/res.zip)

echo "==> javac"
javac --release 11 -encoding UTF-8 -cp "$JAR" -d build/classes \
  $(find android/src build/gen -name '*.java')

echo "==> d8"
mkdir -p build/dex
java -cp "$BT/lib/d8.jar" com.android.tools.r8.D8 --min-api 24 --lib "$JAR" \
  --output build/dex $(find build/classes -name '*.class')

echo "==> package + align"
python3 tools/package_apk.py build/app.apk build/dex/classes.dex build/unsigned.apk

if [ ! -f "$KEYSTORE" ]; then
  echo "==> generate signing key"
  keytool -genkeypair -keystore "$KEYSTORE" -storepass wheelapp -keypass wheelapp \
    -alias wheel -dname "CN=Wheel App,O=DSH,C=CN" -keyalg RSA -keysize 2048 -validity 20000 >/dev/null 2>&1
fi

OUT="$ROOT/dist/云海转盘-v0.2.8.12.apk"
echo "==> sign"
"$BT/apksigner" sign --ks "$KEYSTORE" --ks-pass pass:wheelapp --key-pass pass:wheelapp \
  --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true \
  --out "$OUT" build/unsigned.apk

echo "==> verify"
"$BT/apksigner" verify --print-certs "$OUT" | head -6
ls -lh "$OUT"
