/**
 * UI 主題：Style A — Refined Classic
 * 集中管理像素復古設計系統的色票、字體與文字樣式
 */

// ===== 色票 =====
export const PALETTE = {
  // 背景
  BG_0: 0x050505,
  BG_1: 0x0c0c0c,
  BG_2: 0x141414,
  PANEL: 0x161616,
  PANEL_2: 0x1d1d1d,

  // 主色（金橘）
  GOLD: 0xf5b833,
  GOLD_2: 0xffce5b,
  GOLD_3: 0xb88420,
  GOLD_DEEP: 0x6b4d12,

  // 中性色
  INK_0: 0xfafafa,
  INK_1: 0xd6d6d6,
  INK_2: 0x8c8c8c,
  INK_3: 0x555555,
  INK_4: 0x2a2a2a,

  // 狀態色
  DANGER: 0xec5353,
  DANGER_DEEP: 0x6b1818,
  SUCCESS: 0x4ade80,
  PHOSPHOR: 0x57ff8a,
  PHOSPHOR_DIM: 0x1e6b34
};

// ===== Hex 字串（給 Phaser 文字 fill 用）=====
export const HEX = {
  BG_0: '#050505',
  BG_1: '#0c0c0c',
  BG_2: '#141414',
  PANEL: '#161616',

  GOLD: '#f5b833',
  GOLD_2: '#ffce5b',
  GOLD_3: '#b88420',
  GOLD_DEEP: '#6b4d12',

  INK_0: '#fafafa',
  INK_1: '#d6d6d6',
  INK_2: '#8c8c8c',
  INK_3: '#555555',

  DANGER: '#ec5353',
  DANGER_DEEP: '#6b1818',
  PHOSPHOR: '#57ff8a',
  BLACK: '#000000',
  WHITE: '#ffffff'
};

// ===== 字體 =====
// 'Press Start 2P' 由 public/index.html 透過 Google Fonts 引入（英文像素字型）
// 'Cubic 11' 由 public/index.html @font-face 自託管載入（11×11 繁中像素字型）
// 英文字會優先用 Press Start 2P 渲染，中文字才 fallback 到 Cubic 11，兩者皆為像素風
export const FONT = {
  DISPLAY: '"Press Start 2P", "Cubic 11", "Courier New", monospace',
  UI: '"Press Start 2P", "Cubic 11", "Courier New", monospace',
  MONO: '"JetBrains Mono", "Cubic 11", "Courier New", monospace'
};

// ===== 文字樣式預設 =====
export const TEXT_STYLES = {
  // 大標題（Logo）
  TITLE_HERO: {
    fontFamily: FONT.DISPLAY,
    fontSize: '56px',
    color: HEX.GOLD,
    stroke: HEX.BLACK,
    strokeThickness: 0,
    shadow: {
      offsetX: 4,
      offsetY: 4,
      color: HEX.GOLD_DEEP,
      blur: 0,
      fill: true
    }
  },

  // 區塊標題
  SECTION_TITLE: {
    fontFamily: FONT.DISPLAY,
    fontSize: '22px',
    color: HEX.GOLD,
    stroke: HEX.BLACK,
    strokeThickness: 3
  },

  // 副標題（小寫英文）
  SUBTITLE: {
    fontFamily: FONT.DISPLAY,
    fontSize: '12px',
    color: HEX.INK_1
  },

  // 小標籤（HUD 標籤）
  LABEL_SMALL: {
    fontFamily: FONT.DISPLAY,
    fontSize: '9px',
    color: HEX.INK_2
  },

  LABEL: {
    fontFamily: FONT.DISPLAY,
    fontSize: '11px',
    color: HEX.INK_2
  },

  // 數值（金色 / 大）
  VALUE: {
    fontFamily: FONT.DISPLAY,
    fontSize: '16px',
    color: HEX.GOLD_2
  },

  VALUE_SMALL: {
    fontFamily: FONT.DISPLAY,
    fontSize: '12px',
    color: HEX.GOLD_2
  },

  // 一般白色文字
  BODY: {
    fontFamily: FONT.DISPLAY,
    fontSize: '12px',
    color: HEX.INK_0
  },

  // 鍵盤提示
  KBD_KEY: {
    fontFamily: FONT.DISPLAY,
    fontSize: '10px',
    color: HEX.GOLD_2,
    backgroundColor: HEX.BG_2,
    padding: { x: 6, y: 4 }
  },

  KBD_LABEL: {
    fontFamily: FONT.DISPLAY,
    fontSize: '10px',
    color: HEX.INK_2
  },

  // 按鈕（次要）
  BTN_SECONDARY: {
    fontFamily: FONT.DISPLAY,
    fontSize: '12px',
    color: HEX.INK_1
  },

  // 主按鈕（黑字金底）
  BTN_PRIMARY: {
    fontFamily: FONT.DISPLAY,
    fontSize: '20px',
    color: HEX.BG_0
  }
};

/**
 * 繪製金色角落括號（Style A 招牌邊框裝飾）
 * @param {Phaser.GameObjects.Graphics} g - graphics 物件
 * @param {number} x - 矩形左上 X
 * @param {number} y - 矩形左上 Y
 * @param {number} w - 寬
 * @param {number} h - 高
 * @param {number} [size=14] - 括號邊長
 * @param {number} [thickness=3] - 線條厚度
 * @param {number} [color=PALETTE.GOLD_2] - 顏色
 */
export function drawGoldCorners(g, x, y, w, h, size = 14, thickness = 3, color = PALETTE.GOLD_2) {
  g.lineStyle(thickness, color);

  // 左上
  g.beginPath();
  g.moveTo(x, y + size);
  g.lineTo(x, y);
  g.lineTo(x + size, y);
  g.strokePath();

  // 右下
  g.beginPath();
  g.moveTo(x + w - size, y + h);
  g.lineTo(x + w, y + h);
  g.lineTo(x + w, y + h - size);
  g.strokePath();
}

/**
 * 繪製 modal 雙層金邊框（外深金 + 內亮金）
 */
export function drawModalFrame(g, x, y, w, h, opts = {}) {
  const {
    fillColor = PALETTE.PANEL,
    fillAlpha = 1,
    borderColor = PALETTE.GOLD,
    borderDeep = PALETTE.GOLD_DEEP,
    borderThickness = 3
  } = opts;

  // 內部填色
  g.fillStyle(fillColor, fillAlpha);
  g.fillRect(x, y, w, h);

  // 外圍深金描邊（厚 4px）
  g.lineStyle(4, borderDeep);
  g.strokeRect(x - 4, y - 4, w + 8, h + 8);

  // 內亮金描邊
  g.lineStyle(borderThickness, borderColor);
  g.strokeRect(x, y, w, h);
}

/**
 * 繪製像素愛心（Style A 用於生命顯示）
 * @param {Phaser.GameObjects.Graphics} g
 * @param {number} cx - 中心 X
 * @param {number} cy - 中心 Y
 * @param {number} [scale=2] - 像素縮放（每格邊長 px）
 * @param {boolean} [filled=true] - 是否實心（false 則只描輪廓）
 */
export function drawPixelHeart(g, cx, cy, scale = 2, filled = true) {
  // 7 寬 × 6 高 像素圖案：
  // . X X . X X .
  // X X X X X X X
  // X X X X X X X
  // . X X X X X .
  // . . X X X . .
  // . . . X . . .
  const pattern = [
    [0, 1, 1, 0, 1, 1, 0],
    [1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1],
    [0, 1, 1, 1, 1, 1, 0],
    [0, 0, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 0, 0, 0]
  ];
  const outline = [
    [0, 1, 1, 0, 1, 1, 0],
    [1, 0, 0, 1, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [0, 1, 0, 0, 0, 1, 0],
    [0, 0, 1, 0, 1, 0, 0],
    [0, 0, 0, 1, 0, 0, 0]
  ];
  const grid = filled ? pattern : outline;
  const w = 7;
  const h = 6;
  const startX = cx - (w * scale) / 2;
  const startY = cy - (h * scale) / 2;

  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      if (grid[row][col]) {
        g.fillRect(startX + col * scale, startY + row * scale, scale, scale);
      }
    }
  }
}

/**
 * 繪製像素小坦克 icon（俯視，朝上）
 * @param {Phaser.GameObjects.Graphics} g
 * @param {number} cx - 中心 X
 * @param {number} cy - 中心 Y
 * @param {number} [scale=2] - 像素縮放
 */
export function drawPixelTank(g, cx, cy, scale = 2) {
  // 7 寬 × 6 高
  // . X . . . X .
  // X X X X X X X
  // X X . X . X X
  // X X X X X X X
  // X X X X X X X
  // X X . . . X X
  const grid = [
    [0, 1, 0, 0, 0, 1, 0],
    [1, 1, 1, 1, 1, 1, 1],
    [1, 1, 0, 1, 0, 1, 1],
    [1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1],
    [1, 1, 0, 0, 0, 1, 1]
  ];
  const w = 7;
  const h = 6;
  const startX = cx - (w * scale) / 2;
  const startY = cy - (h * scale) / 2;

  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      if (grid[row][col]) {
        g.fillRect(startX + col * scale, startY + row * scale, scale, scale);
      }
    }
  }
}

/**
 * 格式化分數，加上千位逗號
 */
export function formatScore(value) {
  return Number(value || 0).toLocaleString('en-US');
}

/**
 * 格式化關卡編號（兩位數補零）
 */
export function formatStage(level) {
  return String(level).padStart(2, '0');
}

/**
 * 格式化遊戲時間（mm:ss）
 */
export function formatElapsedTime(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
