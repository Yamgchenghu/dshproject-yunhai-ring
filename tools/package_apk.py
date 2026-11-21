#!/usr/bin/env python3
"""Package aapt2 output + classes.dex into an aligned APK (zipalign replacement)."""
import struct
import sys
import zipfile


def main():
    if len(sys.argv) != 4:
        print("usage: package_apk.py <base.apk> <classes.dex> <out.apk>")
        return 2
    src, dex_path, out = sys.argv[1], sys.argv[2], sys.argv[3]
    zin = zipfile.ZipFile(src)
    with zipfile.ZipFile(out, "w") as zout:
        for info in zin.infolist():
            data = zin.read(info.filename)
            stored = info.compress_type == zipfile.ZIP_STORED
            # Android 11+ requires resources.arsc to be uncompressed and 4-byte aligned.
            if info.filename == "resources.arsc":
                stored = True
            zi = zipfile.ZipInfo(info.filename, date_time=info.date_time)
            zi.compress_type = zipfile.ZIP_STORED if stored else zipfile.ZIP_DEFLATED
            zi.external_attr = info.external_attr
            zi.create_system = 0
            off = zout.fp.tell()
            base = off + 30 + len(zi.filename.encode("utf-8"))
            pad = (-base) % 4 if stored else 0
            extra_len = pad
            if extra_len and extra_len < 4:
                extra_len += 4
            if extra_len:
                zi.extra = struct.pack("<HH", 0xD935, extra_len - 4) + b"\x00" * (extra_len - 4)
            zout.writestr(zi, data)
        zi = zipfile.ZipInfo("classes.dex", date_time=(2020, 1, 1, 0, 0, 0))
        zi.compress_type = zipfile.ZIP_DEFLATED
        zi.external_attr = 0o644 << 16
        with open(dex_path, "rb") as f:
            zout.writestr(zi, f.read())
    print("packaged", out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
