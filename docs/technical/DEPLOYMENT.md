# Tank Battle 部署指南

本文件說明如何將 Tank Battle 部署到 GitHub Pages。

---

## 📋 目錄

1. [部署前提條件](#部署前提條件)
2. [GitHub Pages 部署](#github-pages-部署)
3. [手動部署](#手動部署)
4. [其他部署選項](#其他部署選項)
5. [故障排除](#故障排除)

---

## 部署前提條件

### 系統需求

- ✅ GitHub 帳號
- ✅ Git 已安裝
- ✅ Node.js 24+ 已安裝
- ✅ npm 11+ 已安裝

### 專案需求

- ✅ 所有測試通過（`npm test`）
- ✅ 專案可以成功建置（`npm run build`）
- ✅ 程式碼已推送到 GitHub 儲存庫

---

## GitHub Pages 部署

GitHub Pages 是 **完全免費** 的靜態網站託管服務，非常適合 Tank Battle 這類純前端遊戲專案。

### 方式 1：自動部署（推薦）⭐

使用 GitHub Actions 實現自動化部署，每次推送程式碼到主分支時自動建置和部署。

#### 步驟 1：啟用 GitHub Pages

1. 進入你的 GitHub 儲存庫
2. 點擊 **Settings** > **Pages**
3. 在 **Source** 部分選擇：
   - **Source**: `GitHub Actions`

#### 步驟 2：驗證 GitHub Actions 設定

請建立 `.github/workflows/deploy.yml` 檔案，設定如下：

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main, master ]  # 推送到主分支時觸發
  workflow_dispatch:              # 允許手動觸發

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    permissions:
      contents: read
      pages: write
      id-token: write

    steps:
      # 1. Checkout 程式碼
      - name: Checkout repository
        uses: actions/checkout@v4

      # 2. 設置 Node.js
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'

      # 3. 安裝相依套件
      - name: Install dependencies
        run: npm ci

      # 4. 執行測試
      - name: Run tests
        run: npm test

      # 5. 建置專案
      - name: Build project
        run: npm run build

      # 6. 設定 GitHub Pages
      - name: Setup Pages
        uses: actions/configure-pages@v4

      # 7. 上傳建置產物
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'

      # 8. 部署到 GitHub Pages
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

#### 步驟 3：推送程式碼觸發部署

```bash
# 確保程式碼在主分支
git checkout main  # 或 master

# 推送程式碼
git push origin main

# GitHub Actions 會自動：
# 1. 安裝相依套件
# 2. 執行測試（確保品質）
# 3. 建置專案
# 4. 部署到 GitHub Pages
```

#### 步驟 4：查看部署狀態

1. 進入儲存庫的 **Actions** 標籤
2. 查看 "Deploy to GitHub Pages" 工作流程
3. 等待部署完成（通常 2-5 分鐘）

#### 步驟 5：存取你的遊戲

部署成功後，遊戲將在以下網址存取：

```
https://<你的使用者名稱>.github.io/<儲存庫名稱>/
```

例如：
```
https://twtrubiks.github.io/tank-battle/
```

### 方式 2：手動觸發部署

如果不想等待推送，可以手動觸發部署：

1. 進入儲存庫的 **Actions** 標籤
2. 選擇 "Deploy to GitHub Pages" 工作流程
3. 點擊 **Run workflow** 按鈕
4. 選擇分支（main 或 master）
5. 點擊 **Run workflow** 確認

---

## 手動部署

如果不想使用 GitHub Actions，也可以手動部署。

### 使用 gh-pages 分支

```bash
# 1. 安裝 gh-pages 工具
npm install -g gh-pages

# 2. 進入專案目錄
cd tank-battle

# 3. 建置專案
npm run build

# 4. 部署到 gh-pages 分支
gh-pages -d dist

# 5. 設定 GitHub Pages
# 進入 Settings > Pages
# Source 選擇 "Deploy from a branch"
# Branch 選擇 "gh-pages" 和 "/ (root)"
```

### 直接推送 dist 目錄

```bash
# 1. 建置專案
npm run build

# 2. 進入 dist 目錄
cd dist

# 3. 初始化 git（如果還沒有）
git init
git add .
git commit -m "Deploy to GitHub Pages"

# 4. 推送到 gh-pages 分支
git push -f origin HEAD:gh-pages

# 5. 設定 GitHub Pages（同上）
```

---

## 其他部署選項

Tank Battle 是純靜態網站，可以部署到任何支援靜態網站的平台。

### 自己的伺服器

如果有自己的伺服器（Nginx、Apache 等）：

```bash
# 1. 建置專案
npm run build

# 2. 上傳 dist 目錄到伺服器
scp -r dist/* user@server:/var/www/tank-battle/

# 3. 設定 Nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /var/www/tank-battle;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 故障排除

### 問題 1：GitHub Actions 建置失敗

**錯誤：** `npm test` 失敗

**解決方案：**
```bash
# 在本地執行測試
cd tank-battle
npm test

# 修復所有測試失敗
# 推送修復後的程式碼
```

### 問題 2：404 Not Found

**原因：** 路徑設定問題

**解決方案：**

如果你的儲存庫不是根網域（如 `username.github.io/<repo-name>`），需要設定 base path：

1. 修改 `webpack.config.js`：

```javascript
module.exports = {
  // ...
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.[contenthash].js',
    publicPath: '/tank-battle/',  // 新增這行，替換為你的儲存庫名稱
    clean: true
  },
  // ...
};
```

2. 重新建置並推送：

```bash
npm run build
git add .
git commit -m "Fix base path for GitHub Pages"
git push
```

### 問題 3：樣式或圖片無法載入

**原因：** 資源路徑錯誤

**解決方案：**

確保所有資源使用相對路徑：

```javascript
// ✗ 錯誤：絕對路徑
<img src="/assets/player.png">

// ✓ 正確：相對路徑
<img src="./assets/player.png">
```

### 問題 4：部署後白屏

**可能原因：**
1. JavaScript 錯誤
2. 資源載入失敗
3. Phaser 設定問題

**除錯步驟：**

1. 開啟瀏覽器開發者工具（F12）
2. 查看 Console 錯誤
3. 查看 Network 標籤，確認所有資源已載入
4. 檢查 Phaser 設定

### 問題 5：GitHub Pages 沒有更新

**解決方案：**

1. 清除瀏覽器快取（Ctrl + Shift + R 強制重新整理）
2. 等待幾分鐘（GitHub Pages 可能需要時間）
3. 檢查 Actions 是否成功完成
4. 檢查 Settings > Pages 設定是否正確

---

## 效能最佳化建議

部署後可以進一步最佳化效能：

### 1. 啟用 GZIP 壓縮

GitHub Pages 自動啟用 GZIP，無需額外設定。

### 2. 使用 CDN

```html
<!-- 使用 CDN 載入 Phaser -->
<script src="https://cdn.jsdelivr.net/npm/phaser@4.1.0/dist/phaser.min.js"></script>
```

### 3. 圖片最佳化

```bash
# 使用 imagemin 壓縮圖片
npm install -g imagemin-cli
imagemin assets/**/*.png --out-dir=assets/
```

### 4. 程式碼分割

Webpack 已設定程式碼分割，Phaser 和遊戲程式碼分別打包。

---

## 自訂網域名稱（選用）

如果你有自己的網域名稱，可以設定自訂網域：

1. 在儲存庫根目錄建立 `CNAME` 檔案：
   ```
   tankbattle.yourdomain.com
   ```

2. 在網域 DNS 設定中新增 CNAME 記錄：
   ```
   tankbattle  CNAME  <username>.github.io
   ```

3. 等待 DNS 生效（最多 48 小時）

4. 在 GitHub Settings > Pages 中輸入自訂網域名稱

5. 啟用 "Enforce HTTPS"

---

## 參考資料

- [GitHub Pages 官方文件](https://docs.github.com/en/pages)
- [GitHub Actions 文件](https://docs.github.com/en/actions)
- [Phaser 官方文檔](https://docs.phaser.io/)
- [Webpack 生產模式](https://webpack.js.org/guides/production/)

---

**部署成功後，歡迎分享你的遊戲連結！** 🎮🚀
