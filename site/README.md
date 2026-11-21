# 云海转盘 · GPT-SoVITS 下载页

纯静态页面，无后端依赖。目录内已经包含：

- `index.html` / `assets/`：页面与截图
- `downloads/wheel-clone-server.zip`：克隆服务包（Windows / Linux 脚本）
- `downloads/yunhai-wheel-v0.2.8.6.apk`：云海转盘 App
- `wrangler.toml`、`_headers`：Cloudflare Pages 配置

## 本地预览

```bash
cd site
python3 -m http.server 8080
# 打开 http://127.0.0.1:8080
```

## 部署到 Cloudflare Pages

### 方式 A：控制台（最简单）

1. 登录 Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Upload assets**。
2. 项目名填 `yunhai-wheel-gptsovit`，上传整个 `site/` 目录（或先压缩成 zip 再上传）。
3. 部署完成后会得到 `https://yunhai-wheel-gptsovit.pages.dev`。
4. 进入项目 → **Custom domains** → 添加 `gptsovit.rainstone103.top`。
   - 如果 `rainstone103.top` 托管在 Cloudflare：会自动创建 CNAME，等证书生效即可。
   - 如果 DNS 还在别处：在 DNS 服务商添加 CNAME：`gptsovit` → `yunhai-wheel-gptsovit.pages.dev`。

### 方式 B：命令行

```bash
cd site
npx wrangler pages deploy . --project-name yunhai-wheel-gptsovit
```

首次运行会要求登录 Cloudflare。CI / 自动化可用 **API Token**（不要用账号密码）：

```bash
export CLOUDFLARE_API_TOKEN="只给 Pages:Edit 权限的 token"
export CLOUDFLARE_ACCOUNT_ID="你的 Account ID"
npx wrangler pages deploy . --project-name yunhai-wheel-gptsovit
```

## DNS 说明

- 目标域名：`gptsovit.rainstone103.top`
- 如果 `rainstone103.top` 的 NS 不在 Cloudflare，Pages 的自定义域名无法自动建记录，需要在当前 DNS 服务商手动加 CNAME。
- 记录生效后 Cloudflare 会自动签发证书；刚添加时可能需要几分钟。

## 更新下载文件

```bash
cp ../dist/云海转盘-v1.1.apk downloads/yunhai-wheel-v0.2.8.6.apk
cd ../server && zip -q -r ../site/downloads/wheel-clone-server.zip \
  clone_server.py start_windows.ps1 start_windows.bat start_linux.sh README.md
```

## 安全

- 页面是纯静态文件，没有收集任何数据。
- 不要提交 Cloudflare 的全局 API Key 或 Google 账号密码到仓库；只用最小权限的 API Token。
