package com.dsh.wheel;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.zip.GZIPInputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/** 解析 .pwh：去掉前缀后可能是 gzip / zip，里面是 JSON。 */
public final class PwhDecoder {

    private PwhDecoder() {}

    public static String decode(byte[] raw) throws IOException {
        if (raw == null || raw.length == 0) throw new IOException("文件是空的");
        byte[] cur = stripPrefix(raw);
        for (int depth = 0; depth < 6; depth++) {
            if (isGzip(cur)) {
                cur = readAll(new GZIPInputStream(new ByteArrayInputStream(cur)));
                continue;
            }
            if (isZip(cur)) {
                cur = firstJsonFromZip(cur);
                continue;
            }
            String text = new String(cur, StandardCharsets.UTF_8);
            if (text.startsWith("\uFEFF")) text = text.substring(1);
            text = text.trim();
            if (text.startsWith("{") || text.startsWith("[")) return text;
            int idx = findJsonStart(cur);
            if (idx >= 0) {
                return new String(cur, idx, cur.length - idx, StandardCharsets.UTF_8).trim();
            }
            throw new IOException("文件里没有找到 JSON 数据");
        }
        throw new IOException("文件解压层数过多");
    }

    private static byte[] stripPrefix(byte[] d) {
        int off = 0;
        if (d.length >= 3) {
            String head = new String(d, 0, 3, StandardCharsets.US_ASCII).toLowerCase();
            if ("pwh".equals(head)) off = 3;
        }
        if (d.length > off + 1 && (d[off] & 0xff) == 0x1f && (d[off + 1] & 0xff) == 0x8b) return slice(d, off);
        if (d.length > off + 1 && d[off] == 0x50 && d[off + 1] == 0x4b) return slice(d, off);
        if (d[off] == '{' || d[off] == '[') return slice(d, off);
        int idx = findMagic(d, Math.min(d.length, off + 32), off);
        if (idx >= 0) return slice(d, idx);
        return slice(d, off);
    }

    private static int findMagic(byte[] d, int limit, int from) {
        for (int i = from; i + 1 < limit; i++) {
            int a = d[i] & 0xff, b = d[i + 1] & 0xff;
            if (a == 0x1f && b == 0x8b) return i;
            if (d[i] == 'P' && d[i + 1] == 'K') return i;
            if (d[i] == '{' || d[i] == '[') return i;
        }
        return -1;
    }

    private static int findJsonStart(byte[] d) {
        for (int i = 0; i < d.length; i++) {
            if (d[i] == '{' || d[i] == '[') return i;
        }
        return -1;
    }

    private static byte[] firstJsonFromZip(byte[] data) throws IOException {
        ZipInputStream zis = new ZipInputStream(new ByteArrayInputStream(data));
        byte[] fallback = null;
        try {
            ZipEntry e;
            byte[] buf = new byte[8192];
            while ((e = zis.getNextEntry()) != null) {
                if (e.isDirectory()) continue;
                ByteArrayOutputStream bos = new ByteArrayOutputStream();
                int n;
                while ((n = zis.read(buf)) > 0) bos.write(buf, 0, n);
                byte[] bytes = bos.toByteArray();
                String name = e.getName() == null ? "" : e.getName().toLowerCase(LocaleHolder.ROOT);
                if (name.endsWith(".json")) return bytes;
                if (fallback == null && looksJson(bytes)) fallback = bytes;
            }
        } finally {
            try { zis.close(); } catch (Exception ignored) {}
        }
        if (fallback != null) return fallback;
        throw new IOException("zip 里没有 JSON 文件");
    }

    private static boolean looksJson(byte[] d) {
        int i = 0;
        while (i < d.length && (d[i] == ' ' || d[i] == '\n' || d[i] == '\r' || d[i] == '\t')) i++;
        if (i < d.length && (d[i] & 0xff) == 0xef) i += 3;
        return i < d.length && (d[i] == '{' || d[i] == '[');
    }

    private static boolean isGzip(byte[] d) {
        return d.length > 2 && (d[0] & 0xff) == 0x1f && (d[1] & 0xff) == 0x8b;
    }

    private static boolean isZip(byte[] d) {
        return d.length > 4 && d[0] == 0x50 && d[1] == 0x4b && (d[2] == 0x03 || d[2] == 0x05 || d[2] == 0x07);
    }

    private static byte[] slice(byte[] d, int off) {
        if (off <= 0) return d;
        byte[] out = new byte[d.length - off];
        System.arraycopy(d, off, out, 0, out.length);
        return out;
    }

    private static byte[] readAll(InputStream in) throws IOException {
        try {
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
            return bos.toByteArray();
        } finally {
            try { in.close(); } catch (Exception ignored) {}
        }
    }

    private static final class LocaleHolder {
        static final java.util.Locale ROOT = java.util.Locale.ROOT;
    }
}
