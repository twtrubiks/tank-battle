# Tank Battle 技術棧說明

## 📚 技術棧總覽

Tank Battle 是一個**純前端遊戲專案**，不需要後端服務器，所有遊戲邏輯都在瀏覽器中運行。

---

## 🎮 前端技術

### 核心框架與庫

#### 1. Phaser.js 3.60+ 🎯
**用途：** 遊戲引擎（核心）

**功能：**
- ✅ 遊戲循環管理（update、render）
- ✅ 物理引擎（Arcade Physics）
- ✅ 精靈渲染與動畫
- ✅ 場景管理（Scene System）
- ✅ 輸入處理（鍵盤、滑鼠）
- ✅ 音效管理
- ✅ 碰撞檢測

**為什麼選擇 Phaser？**
- ✓ 專為 2D 遊戲設計
- ✓ 完整的物理引擎
- ✓ 活躍的社群支持
- ✓ 豐富的文檔和範例
- ✓ 免費開源

**使用範例：**
```javascript
// src/scenes/GameScene.js
export default class GameScene extends Phaser.Scene {
  create() {
    // Phaser 提供的遊戲物件創建方法
    this.player = new PlayerTank(this, x, y);
    this.physics.add.collider(this.player, this.walls);
  }

  update(time, delta) {
    // Phaser 每幀調用的更新方法
    this.player.update(time, delta);
  }
}
```

---

#### 2. JavaScript ES6+ 💻
**用途：** 程式語言

**使用的 ES6+ 特性：**
- ✅ **類別 (Classes)** - 物件導向設計
  ```javascript
  export default class Tank extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) { ... }
  }
  ```

- ✅ **箭頭函數 (Arrow Functions)** - 簡潔的函數語法
  ```javascript
  this.enemies.forEach(enemy => enemy.update());
  ```

- ✅ **模組化 (ES6 Modules)** - import/export
  ```javascript
  import PlayerTank from './entities/PlayerTank';
  export default class GameScene { ... }
  ```

- ✅ **解構賦值 (Destructuring)**
  ```javascript
  const { x, y, health } = this.player;
  ```

- ✅ **樣板字串 (Template Literals)**
  ```javascript
  console.log(`Score: ${this.score}`);
  ```

- ✅ **展開運算符 (Spread Operator)**
  ```javascript
  const newState = { ...oldState, score: 100 };
  ```

- ✅ **Promise & Async/Await** - 異步處理
  ```javascript
  async loadLevel(level) {
    const data = await fetch(`/data/level_${level}.json`);
  }
  ```

---

#### 3. HTML5 Canvas 🖼️
**用途：** 渲染引擎

**功能：**
- ✅ 2D 圖形渲染
- ✅ 像素級控制
- ✅ 硬體加速

**說明：**
Phaser 底層使用 HTML5 Canvas API 進行渲染，我們不需要直接操作 Canvas，Phaser 會處理所有渲染細節。

---

### 客戶端存儲

#### 4. LocalStorage API 💾
**用途：** 遊戲存檔系統

**功能：**
- ✅ 儲存遊戲進度（關卡、分數）
- ✅ 儲存最高分
- ✅ 儲存玩家統計數據
- ✅ 儲存設定（音量等）

**使用範例：**
```javascript
// src/managers/SaveManager.js
export default class SaveManager {
  save(data) {
    // 將遊戲數據保存到 LocalStorage
    localStorage.setItem('tank_battle_save_data', JSON.stringify(data));
  }

  load() {
    // 從 LocalStorage 讀取遊戲數據
    const data = localStorage.getItem('tank_battle_save_data');
    return data ? JSON.parse(data) : this.defaultData;
  }
}
```

**特點：**
- ✓ 5-10 MB 存儲空間（足夠遊戲使用）
- ✓ 數據持久化（關閉瀏覽器後仍保留）
- ✓ 無需服務器
- ✓ 即時讀寫

---

## 🛠️ 開發工具鏈

### 建構與打包

#### 5. Webpack 5 📦
**用途：** 模組打包工具

**功能：**
- ✅ **模組打包** - 將多個 JS 文件打包成一個或多個 bundle
- ✅ **代碼分割** - Phaser 和遊戲代碼分別打包
- ✅ **資源處理** - 處理圖片、JSON、音效文件
- ✅ **開發服務器** - 熱重載（Hot Reload）
- ✅ **生產優化** - 壓縮、混淆、Tree Shaking

**配置文件：** `webpack.config.js`

**主要配置：**
```javascript
module.exports = {
  entry: './src/main.js',           // 入口文件
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.[contenthash].js',  // 輸出文件（含 hash）
  },
  optimization: {
    splitChunks: {
      chunks: 'all',                // 代碼分割
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 10,
        }
      }
    }
  },
  plugins: [
    new HtmlWebpackPlugin({ ... }),  // 自動生成 HTML
    new CopyWebpackPlugin({ ... })   // 複製靜態資源
  ]
};
```

**開發命令：**
```bash
npm run dev    # 啟動開發服務器（http://localhost:8080）
npm run build  # 生產構建（輸出到 dist/）
```

---

#### 6. Babel 🔄
**用途：** JavaScript 轉譯器

**功能：**
- ✅ 將 ES6+ 轉譯為 ES5（支援舊瀏覽器）
- ✅ 支援最新 JavaScript 特性
- ✅ 模組轉換（ES6 → CommonJS for Jest）

**配置文件：** `babel.config.js`

```javascript
module.exports = {
  presets: [
    ['@babel/preset-env', {
      targets: {
        browsers: ['> 1%', 'last 2 versions'],  // 支援的瀏覽器
        node: 'current'  // Jest 測試環境
      }
    }]
  ]
};
```

---

### 代碼品質

#### 7. ESLint 🔍
**用途：** JavaScript 代碼檢查工具

**功能：**
- ✅ 檢查語法錯誤
- ✅ 強制代碼風格統一
- ✅ 發現潛在 bug
- ✅ 最佳實踐建議

**配置文件：** `.eslintrc.js`

**檢查命令：**
```bash
npm run lint      # 檢查代碼
npm run lint:fix  # 自動修復問題
```

---

### 測試框架

#### 8. Jest 🧪
**用途：** JavaScript 測試框架

**功能：**
- ✅ 單元測試
- ✅ 覆蓋率報告
- ✅ 模擬（Mock）功能
- ✅ 快照測試

**測試統計：**
- 📊 **8 個測試套件**
- 📊 **112 個測試案例**
- 📊 **全部通過**

**測試範例：**
```javascript
// tests/unit/SaveManager.test.js
describe('SaveManager', () => {
  test('應該正確保存和載入數據', () => {
    const saveManager = new SaveManager();
    const testData = { level: 5, score: 10000 };

    saveManager.save(testData);
    const loaded = saveManager.load();

    expect(loaded.level).toBe(5);
    expect(loaded.score).toBe(10000);
  });
});
```

**測試命令：**
```bash
npm test              # 運行所有測試
npm test -- --watch   # 監聽模式
npm test -- --coverage  # 生成覆蓋率報告
```

---

#### 9. jsdom 🌐
**用途：** DOM 模擬環境（for Jest）

**功能：**
- ✅ 在 Node.js 環境模擬瀏覽器 DOM
- ✅ 測試依賴 DOM 的代碼
- ✅ 無需真實瀏覽器

**配置：** `jest.config.js`
```javascript
module.exports = {
  testEnvironment: 'jsdom',  // 使用 jsdom 環境
};
```

---

## 🚀 CI/CD 與部署

#### 10. GitHub Actions ⚙️
**用途：** 持續集成與部署

**功能：**
- ✅ 自動運行測試
- ✅ 自動構建項目
- ✅ 自動部署到 GitHub Pages
- ✅ 推送即部署

**工作流文件：** `.github/workflows/deploy.yml`

**流程：**
```
推送代碼 → 安裝依賴 → 運行測試 → 構建 → 部署
```

---

#### 11. GitHub Pages 🌍
**用途：** 靜態網站托管

**功能：**
- ✅ 免費托管
- ✅ 自動 HTTPS
- ✅ 全球 CDN
- ✅ 自定義域名

**訪問地址：**
```
https://<用戶名>.github.io/<倉庫名>/
```

---

## 📝 數據格式

#### 12. JSON 📋
**用途：** 遊戲配置與關卡數據

**使用場景：**
- ✅ 關卡地圖數據（`level_1.json` ~ `level_5.json`）
- ✅ 敵人波次配置
- ✅ 道具生成規則
- ✅ 遊戲配置

**範例：**
```json
// public/data/level_1.json
{
  "levelNumber": 1,
  "name": "關卡 1 - 新手村",
  "enemyWaves": [
    { "type": "BASIC", "count": 8, "spawnInterval": 4000 },
    { "type": "FAST", "count": 2, "spawnInterval": 5000 }
  ],
  "map": [
    [0, 0, 0, 1, 1, 0, ...],  // 26x26 地圖
    ...
  ]
}
```

---

## 🎨 設計模式

雖然不是技術工具，但專案使用了多種設計模式：

| 設計模式 | 用途 | 文件位置 |
|---------|------|---------|
| **狀態機模式** | 敵人 AI 行為管理 | `src/utils/StateMachine.js` |
| **物件池模式** | 子彈重用（效能優化） | `src/utils/ObjectPool.js` |
| **觀察者模式** | 事件系統 | Phaser Events API |
| **工廠模式** | 敵人生成 | `src/utils/Constants.js` |
| **單例模式** | 管理器類別 | `src/managers/` |

詳細說明：[設計模式詳解](./docs/design-patterns.md)

---

## ❌ 不使用的技術（說明為什麼）

### 不需要後端框架

**不使用：**
- ❌ Node.js 服務器
- ❌ Express.js
- ❌ 數據庫（MySQL、MongoDB）
- ❌ API 服務

**原因：**
- ✓ 純單機遊戲，無需多人聯機
- ✓ 使用 LocalStorage 存儲數據
- ✓ 所有邏輯在客戶端運行
- ✓ 降低成本和複雜度

**如果未來需要後端：**
- 排行榜系統 → 需要 API + 數據庫
- 多人模式 → 需要 WebSocket 服務器
- 賬號系統 → 需要後端 + 數據庫

---

### 不使用前端框架

**不使用：**
- ❌ React
- ❌ Vue
- ❌ Angular

**原因：**
- ✓ Phaser 自帶場景管理系統
- ✓ 遊戲不需要複雜的 UI 組件
- ✓ 使用原生 JavaScript 更輕量
- ✓ 避免框架學習曲線

---

### 不使用 TypeScript

**不使用：**
- ❌ TypeScript

**原因：**
- ✓ 項目規模適中，JavaScript 足夠
- ✓ 降低學習門檻
- ✓ 快速開發

**未來可選：**
- 如果項目擴展到 10000+ 行
- 如果團隊規模擴大
- 如果需要更嚴格的類型檢查

---

## 📊 技術棧總結

### 前端技術棧

| 類別 | 技術 | 版本 | 用途 |
|-----|------|------|------|
| **遊戲引擎** | Phaser.js | 3.60+ | 核心遊戲邏輯 |
| **程式語言** | JavaScript | ES6+ | 開發語言 |
| **渲染** | HTML5 Canvas | - | 2D 圖形渲染 |
| **存儲** | LocalStorage | - | 遊戲存檔 |
| **打包工具** | Webpack | 5.x | 模組打包 |
| **轉譯器** | Babel | 7.x | ES6+ → ES5 |
| **代碼檢查** | ESLint | 8.x | 代碼品質 |
| **測試框架** | Jest | 29.x | 單元測試 |
| **DOM 模擬** | jsdom | 30.x | 測試環境 |
| **CI/CD** | GitHub Actions | - | 自動部署 |
| **托管** | GitHub Pages | - | 靜態網站 |

### 後端技術棧

**無需後端！** 這是一個純前端項目。

---

## 🌟 技術亮點

### 1. 零後端成本
- ✅ 完全免費部署
- ✅ 無需服務器維護
- ✅ 無需數據庫

### 2. 現代化工具鏈
- ✅ ES6+ 現代 JavaScript
- ✅ 自動化測試（112 tests）
- ✅ 自動化部署（GitHub Actions）
- ✅ 熱重載開發體驗

### 3. 高性能優化
- ✅ 物件池（減少 GC）
- ✅ 代碼分割（Phaser 單獨打包）
- ✅ 壓縮混淆（生產構建）
- ✅ 緩存策略（contenthash）

### 4. 專業級架構
- ✅ 模組化設計（30 個模組）
- ✅ 設計模式應用（5 種模式）
- ✅ 完整測試覆蓋（112 tests）
- ✅ 詳細文檔（5 個 MD 文件）

---

## 🎓 學習資源

### Phaser.js
- [官方文檔](https://photonstorm.github.io/phaser3-docs/)
- [官方範例](https://phaser.io/examples)
- [官方教程](https://phaser.io/tutorials)

### Webpack
- [官方文檔](https://webpack.js.org/)
- [中文文檔](https://webpack.docschina.org/)

### Jest
- [官方文檔](https://jestjs.io/)
- [中文文檔](https://jestjs.io/zh-Hans/)

### JavaScript ES6+
- [MDN 文檔](https://developer.mozilla.org/zh-TW/docs/Web/JavaScript)
- [ES6 入門教程](https://es6.ruanyifeng.com/)

---

## 💡 總結

Tank Battle 是一個**現代化的純前端遊戲項目**，特點是：

✅ **簡單高效** - 無後端，降低複雜度
✅ **完全免費** - 零成本部署
✅ **專業品質** - 完整測試、文檔、CI/CD
✅ **易於維護** - 清晰的架構和設計模式
✅ **快速開發** - 現代化工具鏈

非常適合用於：
- 🎮 學習遊戲開發
- 📚 學習前端工程化
- 🔧 學習設計模式
- 🚀 快速構建 HTML5 遊戲

---
