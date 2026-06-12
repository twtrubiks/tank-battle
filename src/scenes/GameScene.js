/**
 * 主遊戲場景
 * 整合所有遊戲系統
 */

import Phaser from 'phaser';
import { SCENES, GAME_CONFIG, ENEMY_TYPES, EVENTS, DEPTHS, TILE_TYPES, POWERUP_TYPES } from '../utils/Constants';
import {
  PALETTE,
  HEX,
  TEXT_STYLES,
  drawPixelHeart,
  formatScore,
  formatStage
} from '../utils/UITheme';
import PlayerTank from '../entities/PlayerTank';
import EnemyTank from '../entities/EnemyTank';
import Bullet from '../entities/Bullet';
import PowerUp from '../entities/PowerUp';
import Base from '../entities/Base';
import BrickWall from '../entities/BrickWall';
import SteelWall from '../entities/SteelWall';
import Water from '../entities/Water';
import Ice from '../entities/Ice';
import Forest from '../entities/Forest';
import CollisionSystem from '../systems/CollisionSystem';
import EnemyAI from '../systems/EnemyAI';
import AIBlackboard from '../systems/AIBlackboard';
import GridMovement from '../utils/GridMovement';
import ObjectPool from '../utils/ObjectPool';
import AudioManager from '../managers/AudioManager';
import SaveManager from '../managers/SaveManager';

export default class GameScene extends Phaser.Scene {
  // ==========================================
  // 生命週期方法
  // ==========================================

  constructor() {
    super({ key: SCENES.GAME });
  }

  init(data) {
    this.currentLevel = data.level || 1;
    // 保存從上一關傳來的玩家狀態
    this.savedLives = data.lives || null;
    this.savedStarLevel = data.starLevel || null;

    // UI 顯示狀態
    this.uiVisible = true;
    this.uiElements = [];
  }

  create() {
    // 設定物理世界邊界（限制坦克與子彈在 HUD 之間的可玩區域）
    this.physics.world.setBounds(
      0,
      GAME_CONFIG.PLAY_OFFSET_Y,
      GAME_CONFIG.WIDTH,
      GAME_CONFIG.PLAY_HEIGHT
    );

    // 初始化系統
    this.initializeSystems();

    // 載入關卡
    this.loadLevel();

    // 建立地圖
    this.createMap();

    // 建立基地
    this.createBase();

    // 建立玩家
    this.createPlayer();

    // 建立 UI
    this.createUI();

    // 設定輸入
    this.setupInput();

    // 啟動敵人生成
    this.startEnemySpawning();

    // 初始化 UI
    this.updateLevel(this.currentLevel);
    this.updateEnemies();

    // 播放遊戲開始音效
    if (this.audioManager && this.audioManager.playSFX) {
      this.audioManager.playSFX('gamestart', 0.5);
    }
  }

  // ==========================================
  // 系統初始化
  // ==========================================

  initializeSystems() {
    // 存檔管理器
    this.saveManager = new SaveManager();
    this.saveManager.recordGameStart();

    // 音效管理器
    this.audioManager = new AudioManager(this);

    // 碰撞系統
    this.collisionSystem = new CollisionSystem(this);
    this.collisionSystem.init();

    // AI 黑板系統（敵人團隊協作）
    this.aiBlackboard = new AIBlackboard(this);

    // 子彈池
    this.bulletPool = new ObjectPool(
      () => new Bullet(this, 0, 0),
      20,
      50
    );

    // 子彈群組
    this.bullets = this.add.group();

    // 敵人群組
    this.enemies = this.add.group();

    // 道具群組
    this.powerUps = this.add.group();

    // 特殊地形群組
    this.iceTerrains = this.add.group();
    this.forestTerrains = this.add.group();

    // 遊戲狀態
    this.gameState = {
      score: 0,
      lives: 3,
      level: this.currentLevel,
      enemiesRemaining: 0,
      enemiesKilled: 0,
      isPaused: false,
      baseProtected: false
    };

    // 監聽事件（只監聽一次！）
    this.events.once('shutdown', this.shutdown, this);
    this.events.on(EVENTS.PLAYER_DESTROYED, this.onPlayerDestroyed, this);
    this.events.on(EVENTS.ENEMY_DESTROYED, this.onEnemyDestroyed, this);
    this.events.on(EVENTS.SCORE_CHANGED, this.updateScore, this);
    this.events.on(EVENTS.LIVES_CHANGED, this.updateLives, this);
  }

  loadLevel() {
    // 嘗試載入關卡資料
    const levelKey = `level_${this.currentLevel}`;

    // 檢查關卡資料是否存在
    if (this.cache.json.exists(levelKey)) {
      // 深拷貝：遊戲進行中會即時更新 map（牆壁破壞同步），
      // 不可直接修改 Phaser JSON cache 中的共享物件，否則重玩關卡時地圖會缺牆
      this.levelData = JSON.parse(JSON.stringify(this.cache.json.get(levelKey)));
    } else {
      // 使用預設關卡資料
      this.levelData = this.getDefaultLevelData();
    }

    // 計算敵人總數
    this.gameState.enemiesRemaining = this.levelData.enemyWaves.reduce(
      (sum, wave) => sum + wave.count,
      0
    );
  }

  getDefaultLevelData() {
    return {
      levelNumber: this.currentLevel,
      name: `Level ${this.currentLevel}`,

      playerSpawn: { x: 8, y: 24 },
      basePosition: { x: 12, y: 24 },

      enemySpawns: [
        { x: 0, y: 0 },
        { x: 12, y: 0 },
        { x: 24, y: 0 }
      ],

      enemyWaves: [
        { type: 'BASIC', count: 10, spawnInterval: 3000 },
        { type: 'FAST', count: 3, spawnInterval: 3000 }
      ],

      // 簡單的地圖（只有邊框和基地保護牆）
      map: this.generateSimpleMap(),

      specialRules: {
        maxEnemiesOnScreen: 3,
        baseProtection: false,
        timeLimit: 0
      }
    };
  }

  generateSimpleMap() {
    // 建立 26x26 的空地圖
    const map = Array(26).fill(null).map(() => Array(26).fill(TILE_TYPES.EMPTY));

    // 基地周圍保護牆（磚牆）
    const baseX = 12;
    const baseY = 24;

    // 基地周圍一圈磚牆
    for (let x = baseX - 1; x <= baseX + 1; x++) {
      for (let y = baseY - 1; y <= baseY + 1; y++) {
        if (x === baseX && y === baseY) {
          map[y][x] = TILE_TYPES.BASE;
        } else {
          map[y][x] = TILE_TYPES.BRICK;
        }
      }
    }

    // 加入一些障礙物
    map[5][5] = map[5][6] = TILE_TYPES.BRICK;
    map[5][19] = map[5][20] = TILE_TYPES.BRICK;
    map[12][8] = map[12][9] = TILE_TYPES.STEEL;
    map[12][16] = map[12][17] = TILE_TYPES.STEEL;

    // 加入特殊地形用於測試
    // 水域（阻擋坦克）
    map[8][10] = map[8][11] = map[8][12] = TILE_TYPES.WATER;
    map[9][10] = map[9][11] = map[9][12] = TILE_TYPES.WATER;

    // 冰地（滑行效果）
    map[8][14] = map[8][15] = map[8][16] = TILE_TYPES.ICE;
    map[9][14] = map[9][15] = map[9][16] = TILE_TYPES.ICE;
    map[10][14] = map[10][15] = map[10][16] = TILE_TYPES.ICE;

    // 森林（視覺遮蔽）
    map[15][10] = map[15][11] = map[15][12] = TILE_TYPES.FOREST;
    map[16][10] = map[16][11] = map[16][12] = TILE_TYPES.FOREST;
    map[17][10] = map[17][11] = map[17][12] = TILE_TYPES.FOREST;

    return map;
  }

  // ==========================================
  // 實體創建
  // ==========================================

  createMap() {
    // 建立地圖背景（僅可玩區域）
    const bg = this.add.rectangle(
      0,
      GAME_CONFIG.PLAY_OFFSET_Y,
      GAME_CONFIG.WIDTH,
      GAME_CONFIG.PLAY_HEIGHT,
      0x000000
    );
    bg.setOrigin(0, 0);
    bg.setDepth(DEPTHS.BACKGROUND);

    // 根據地圖資料建立地圖元素
    const map = this.levelData.map;
    const tileSize = GAME_CONFIG.TILE_SIZE;
    const offsetY = GAME_CONFIG.PLAY_OFFSET_Y;

    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        const tileType = map[y][x];
        const worldX = x * tileSize + tileSize / 2;
        const worldY = y * tileSize + tileSize / 2 + offsetY;

        switch (tileType) {
        case TILE_TYPES.BRICK:
          const brick = new BrickWall(this, worldX, worldY);
          this.collisionSystem.addWall(brick);
          break;

        case TILE_TYPES.STEEL:
          const steel = new SteelWall(this, worldX, worldY);
          this.collisionSystem.addWall(steel);
          break;

        case TILE_TYPES.WATER:
          const water = new Water(this, worldX, worldY);
          this.collisionSystem.addWall(water); // 水域阻擋坦克
          break;

        case TILE_TYPES.ICE:
          const ice = new Ice(this, worldX, worldY);
          this.iceTerrains.add(ice);
          break;

        case TILE_TYPES.FOREST:
          const forest = new Forest(this, worldX, worldY);
          this.forestTerrains.add(forest);
          break;

        case TILE_TYPES.BASE:
          // 基地在 createBase() 中單獨建立
          break;
        }
      }
    }

    // 建立邊框（僅可玩區域）
    const graphics = this.add.graphics();
    graphics.lineStyle(4, 0x404040);
    graphics.strokeRect(0, GAME_CONFIG.PLAY_OFFSET_Y, GAME_CONFIG.WIDTH, GAME_CONFIG.PLAY_HEIGHT);
    graphics.setDepth(DEPTHS.MAP_UPPER);
  }

  createBase() {
    // 從關卡資料取得基地位置
    const basePos = this.levelData.basePosition;
    const tileSize = GAME_CONFIG.TILE_SIZE;
    const worldX = basePos.x * tileSize + tileSize / 2;
    const worldY = basePos.y * tileSize + tileSize / 2 + GAME_CONFIG.PLAY_OFFSET_Y;

    this.base = new Base(this, worldX, worldY);
    this.collisionSystem.addBase(this.base);
  }

  createPlayer() {
    const spawn = this.levelData.playerSpawn;
    const safeSpawn = this.findSafeSpawnPosition(spawn.x, spawn.y);
    const tileSize = GAME_CONFIG.TILE_SIZE;
    const worldX = safeSpawn.x * tileSize + tileSize / 2;
    const worldY = safeSpawn.y * tileSize + tileSize / 2 + GAME_CONFIG.PLAY_OFFSET_Y;

    this.player = new PlayerTank(this, worldX, worldY);

    // 恢復從上一關傳來的玩家狀態
    if (this.savedLives !== null) {
      this.player.lives = this.savedLives;
    }
    if (this.savedStarLevel !== null) {
      // 恢復星星等級和對應的屬性
      this.player.starLevel = this.savedStarLevel;
      this._restoreStarUpgrades(this.player);
    }

    this.collisionSystem.addPlayer(this.player);
  }

  /**
   * 恢復星星升級效果
   * @param {PlayerTank} player - 玩家坦克
   * @private
   */
  _restoreStarUpgrades(player) {
    // 根據星星等級恢復對應的屬性
    switch (player.starLevel) {
    case 4:
      player.maxBullets = 3;
      // 繼續往下執行，累積所有效果
    case 3:
      player.bulletDamage = 2;
      // 繼續往下執行
    case 2:
      if (player.starLevel === 2) {
        player.maxBullets = 2;
      }
      // 繼續往下執行
    case 1:
      player.speed = player.baseSpeed * 1.3;
      break;
    }
  }

  // ==========================================
  // 輔助方法 - 安全生成位置檢查
  // ==========================================

  /**
   * 尋找安全的生成位置
   * @param {number} x - 原始 x 座標
   * @param {number} y - 原始 y 座標
   * @returns {{x: number, y: number}} 安全的生成位置
   */
  findSafeSpawnPosition(x, y) {
    const map = this.levelData.map;

    // 檢查原始位置是否安全
    if (this.isPositionSafe(x, y, map)) {
      return { x, y };
    }

    // 如果不安全，在周圍尋找安全位置
    console.warn(`⚠️ 玩家生成位置 (${x}, ${y}) 不安全，正在尋找替代位置...`);

    // 搜尋範圍逐漸擴大
    for (let radius = 1; radius <= 5; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          // 只檢查當前半徑邊緣的點（避免重複檢查）
          if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
            const newX = x + dx;
            const newY = y + dy;

            if (this.isPositionSafe(newX, newY, map)) {
              console.log(`✅ 找到安全位置: (${newX}, ${newY})`);
              return { x: newX, y: newY };
            }
          }
        }
      }
    }

    // 如果還是找不到，使用預設安全位置
    console.error('❌ 無法找到安全生成位置，使用預設位置 (8, 24)');
    return { x: 8, y: 24 };
  }

  /**
   * 將世界座標對應的地圖格子設為指定地形
   * 牆壁實體與 levelData.map 必須保持同步，AI 走位判斷與尋路都依賴 map
   * @param {number} worldX - 世界 X 座標
   * @param {number} worldY - 世界 Y 座標
   * @param {number} tileType - TILE_TYPES 地形類型
   */
  setMapTileAt(worldX, worldY, tileType) {
    if (!this.levelData || !this.levelData.map) return;

    const map = this.levelData.map;
    const tileSize = GAME_CONFIG.TILE_SIZE;
    const gridX = Math.floor(worldX / tileSize);
    const gridY = Math.floor((worldY - GAME_CONFIG.PLAY_OFFSET_Y) / tileSize);

    if (gridY < 0 || gridY >= map.length || gridX < 0 || gridX >= map[0].length) {
      return;
    }

    map[gridY][gridX] = tileType;
  }

  /**
   * 檢查位置是否安全（可以生成坦克）
   * @param {number} x - x 座標
   * @param {number} y - y 座標
   * @param {Array} map - 地圖數據
   * @returns {boolean} 是否安全
   */
  isPositionSafe(x, y, map) {
    // 檢查是否超出地圖邊界
    if (y < 0 || y >= map.length || x < 0 || x >= map[0].length) {
      return false;
    }

    const tileType = map[y][x];

    // 安全的地形類型：空地(0)、冰地(4)、森林(5)
    const safeTiles = [TILE_TYPES.EMPTY, TILE_TYPES.ICE, TILE_TYPES.FOREST];

    return safeTiles.includes(tileType);
  }

  createUI() {
    // 記錄遊戲開始時間
    this.gameStartTime = this.time.now;

    // 載入最高分（顯示於頂列右側）
    this.highScore = this.saveManager ? this.saveManager.getHighScore() : 0;

    // 計算最大敵人總數（用於敵人格網）
    this.totalEnemyCount = this.gameState.enemiesRemaining;

    const W = GAME_CONFIG.WIDTH;
    const H = GAME_CONFIG.HEIGHT;
    const TOP_H = 44;
    const BOT_H = 36;

    // ===== 頂部 HUD 條 =====
    this.createTopBar(W, TOP_H);

    // ===== 底部狀態條 =====
    this.createBottomBar(W, H, BOT_H);
  }

  /**
   * 建立頂部 HUD 條（44px）
   * 結構：[STAGE chip] [SCORE / HI] [LIVES hearts] [ENEMY GRID]
   */
  createTopBar(width, height) {
    // 背景（漸層黑，完全不透明因為位於遊戲場上方）
    const bg = this.add.rectangle(0, 0, width, height, PALETTE.BG_1, 1).setOrigin(0);
    bg.setDepth(DEPTHS.UI).setScrollFactor(0);
    bg.__baseAlpha = 1;
    this.uiElements.push(bg);

    // 上半段較亮的線條（漸層感）
    const highlight = this.add.rectangle(0, 0, width, 1, 0x1a1a1a, 1).setOrigin(0);
    highlight.setDepth(DEPTHS.UI).setScrollFactor(0);
    this.uiElements.push(highlight);

    // 底部金色分隔線
    const sep = this.add.rectangle(0, height - 2, width, 2, PALETTE.GOLD_DEEP).setOrigin(0);
    sep.setDepth(DEPTHS.UI).setScrollFactor(0);
    this.uiElements.push(sep);

    let cursorX = 14;
    const midY = height / 2;

    // ----- STAGE 標籤（金底黑字）-----
    const stageW = 132;
    const stageBg = this.add.rectangle(cursorX, midY, stageW, 24, PALETTE.GOLD).setOrigin(0, 0.5);
    stageBg.setDepth(DEPTHS.UI).setScrollFactor(0);
    this.uiElements.push(stageBg);

    this.stageChipText = this.add.text(cursorX + stageW / 2, midY, `STAGE ${formatStage(this.currentLevel)}`, {
      fontFamily: TEXT_STYLES.LABEL_SMALL.fontFamily,
      fontSize: '10px',
      color: HEX.BG_0
    }).setOrigin(0.5).setLetterSpacing(3).setDepth(DEPTHS.UI).setScrollFactor(0);
    this.uiElements.push(this.stageChipText);

    cursorX += stageW + 22;

    // ----- SCORE 區塊 -----
    const scoreLbl = this.add.text(cursorX, midY - 8, 'SCORE', {
      fontFamily: TEXT_STYLES.LABEL_SMALL.fontFamily,
      fontSize: '9px',
      color: HEX.INK_2
    }).setOrigin(0, 0.5).setLetterSpacing(2).setDepth(DEPTHS.UI).setScrollFactor(0);
    this.uiElements.push(scoreLbl);

    this.scoreText = this.add.text(cursorX, midY + 9, '0', {
      fontFamily: TEXT_STYLES.VALUE.fontFamily,
      fontSize: '13px',
      color: HEX.GOLD_2
    }).setOrigin(0, 0.5).setLetterSpacing(1).setDepth(DEPTHS.UI).setScrollFactor(0);
    this.uiElements.push(this.scoreText);

    cursorX += 130;

    // ----- HI score -----
    const hiLbl = this.add.text(cursorX, midY - 8, 'HI', {
      fontFamily: TEXT_STYLES.LABEL_SMALL.fontFamily,
      fontSize: '9px',
      color: HEX.INK_2
    }).setOrigin(0, 0.5).setLetterSpacing(2).setDepth(DEPTHS.UI).setScrollFactor(0);
    this.uiElements.push(hiLbl);

    this.hiScoreText = this.add.text(cursorX, midY + 9, formatScore(this.highScore), {
      fontFamily: TEXT_STYLES.LABEL_SMALL.fontFamily,
      fontSize: '11px',
      color: HEX.INK_1
    }).setOrigin(0, 0.5).setLetterSpacing(1).setDepth(DEPTHS.UI).setScrollFactor(0);
    this.uiElements.push(this.hiScoreText);

    cursorX += 120;

    // ----- LIVES（愛心列）-----
    const livesAreaX = cursorX;
    const livesDivider = this.add.rectangle(livesAreaX - 10, midY, 1, 26, PALETTE.GOLD_DEEP).setOrigin(0.5);
    livesDivider.setDepth(DEPTHS.UI).setScrollFactor(0);
    this.uiElements.push(livesDivider);

    const livesLbl = this.add.text(livesAreaX, midY, 'LIVES', {
      fontFamily: TEXT_STYLES.LABEL_SMALL.fontFamily,
      fontSize: '9px',
      color: HEX.INK_2
    }).setOrigin(0, 0.5).setLetterSpacing(2).setDepth(DEPTHS.UI).setScrollFactor(0);
    this.uiElements.push(livesLbl);

    // "LIVES" letterSpacing 2、9px 字體 ≈ 5*9 + 4*2 = 53px → 預留 64
    this.livesAnchorX = livesAreaX + 64;
    this.livesAnchorY = midY;
    this.livesGraphics = this.add.graphics();
    this.livesGraphics.setDepth(DEPTHS.UI).setScrollFactor(0);
    this.uiElements.push(this.livesGraphics);
    this.renderLives(this.gameState.lives);

    // 愛心列實際結束於 anchor + 3*21 + 2*6 = anchor + 75
    // 分隔線位於 cursorX - 10，需確保 cursorX - 10 > 75，否則第三顆愛心右側會被分隔線蓋住
    cursorX = this.livesAnchorX + 92;

    // ----- ENEMY GRID（敵人剩餘格網，5×3）-----
    const enemyAreaX = cursorX;
    const enemyDivider = this.add.rectangle(enemyAreaX - 10, midY, 1, 26, PALETTE.GOLD_DEEP).setOrigin(0.5);
    enemyDivider.setDepth(DEPTHS.UI).setScrollFactor(0);
    this.uiElements.push(enemyDivider);

    this.enemyGridLabel = this.add.text(enemyAreaX, midY, '敵 0/0', {
      fontFamily: TEXT_STYLES.LABEL_SMALL.fontFamily,
      fontSize: '11px',
      color: HEX.INK_1,
      padding: { x: 0, y: 2 }
    }).setOrigin(0, 0.5).setLetterSpacing(2).setDepth(DEPTHS.UI).setScrollFactor(0);
    this.uiElements.push(this.enemyGridLabel);

    // 11px 下「敵 11/15」實際渲染寬度約 90~100px，預留 110 避免與敵人格網重疊
    this.enemyGridAnchorX = enemyAreaX + 110;
    this.enemyGridAnchorY = midY;
    this.enemyGridGraphics = this.add.graphics();
    this.enemyGridGraphics.setDepth(DEPTHS.UI).setScrollFactor(0);
    this.uiElements.push(this.enemyGridGraphics);
    this.renderEnemyGrid();

    // 為了讓 levelText 變更不會 NPE，保留一個 dummy（指向同一 stage chip 文字）
    this.levelText = this.stageChipText;
  }

  /**
   * 建立底部狀態條
   */
  createBottomBar(width, mainHeight, height) {
    const y = mainHeight - height;

    const bg = this.add.rectangle(0, y, width, height, PALETTE.BG_1, 1).setOrigin(0);
    bg.setDepth(DEPTHS.UI).setScrollFactor(0);
    bg.__baseAlpha = 1;
    this.uiElements.push(bg);

    const sep = this.add.rectangle(0, y, width, 2, PALETTE.GOLD_DEEP).setOrigin(0);
    sep.setDepth(DEPTHS.UI).setScrollFactor(0);
    this.uiElements.push(sep);

    const midY = y + height / 2;

    // 左：鍵盤提示（中文用 Cubic 11，11px 為其 native 像素尺寸才銳利）
    const left = this.add.text(14, midY, '[TAB] HUD · [P] 暫停 · [SPC] 射擊', {
      fontFamily: TEXT_STYLES.LABEL_SMALL.fontFamily,
      fontSize: '11px',
      color: HEX.INK_1,
      padding: { x: 0, y: 2 }
    }).setOrigin(0, 0.5).setLetterSpacing(2).setDepth(DEPTHS.UI).setScrollFactor(0);
    this.uiElements.push(left);

    // 中：擊殺數 / 時間
    // 鍵盤提示串改 11px 後變寬約 ~376px，KILLS 起點需往右挪避免重疊
    this.killsText = this.add.text(width / 2 + 20, midY, 'KILLS · 0', {
      fontFamily: TEXT_STYLES.LABEL_SMALL.fontFamily,
      fontSize: '9px',
      color: HEX.INK_2
    }).setOrigin(0, 0.5).setLetterSpacing(2).setDepth(DEPTHS.UI).setScrollFactor(0);
    this.uiElements.push(this.killsText);

    this.timerText = this.add.text(width / 2 + 120, midY, 'TIME · 00:00', {
      fontFamily: TEXT_STYLES.LABEL_SMALL.fontFamily,
      fontSize: '9px',
      color: HEX.INK_2
    }).setOrigin(0, 0.5).setLetterSpacing(2).setDepth(DEPTHS.UI).setScrollFactor(0);
    this.uiElements.push(this.timerText);

    // 右：自動存檔狀態
    const right = this.add.text(width - 14, midY, '● AUTO-SAVE', {
      fontFamily: TEXT_STYLES.LABEL_SMALL.fontFamily,
      fontSize: '9px',
      color: HEX.PHOSPHOR
    }).setOrigin(1, 0.5).setLetterSpacing(2).setDepth(DEPTHS.UI).setScrollFactor(0);
    this.uiElements.push(right);
  }

  /**
   * 渲染愛心生命列
   */
  renderLives(lives) {
    if (!this.livesGraphics) return;
    this.livesGraphics.clear();

    const max = 3;
    const scale = 3;
    const heartW = 7 * scale;
    const gap = 6;
    const live = Math.max(0, Math.min(max, lives || 0));

    for (let i = 0; i < max; i++) {
      const cx = this.livesAnchorX + heartW / 2 + i * (heartW + gap);
      const cy = this.livesAnchorY;
      if (i < live) {
        this.livesGraphics.fillStyle(PALETTE.DANGER, 1);
        drawPixelHeart(this.livesGraphics, cx, cy, scale, true);
      } else {
        this.livesGraphics.fillStyle(PALETTE.DANGER, 0.18);
        drawPixelHeart(this.livesGraphics, cx, cy, scale, false);
      }
    }
  }

  /**
   * 渲染敵人剩餘格網（5 欄 × 3 列 = 最多 15）
   * 大於 15 時自動延伸至 4 列（最多 20）
   */
  renderEnemyGrid() {
    if (!this.enemyGridGraphics) return;
    this.enemyGridGraphics.clear();

    const total = this.totalEnemyCount || 0;
    const remaining = this.gameState.enemiesRemaining || 0;
    const dead = Math.max(0, total - remaining);

    if (this.enemyGridLabel) {
      this.enemyGridLabel.setText(`敵 ${remaining}/${total}`);
    }

    if (total === 0) return;

    const cols = 5;
    const rows = Math.max(3, Math.ceil(total / cols));
    const cellSize = 8;
    const gap = 3;

    for (let i = 0; i < total; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = this.enemyGridAnchorX + col * (cellSize + gap);
      const cy = this.enemyGridAnchorY - ((rows - 1) * (cellSize + gap)) / 2 + row * (cellSize + gap);

      const isDead = i < dead;
      if (isDead) {
        // 已擊敗：暗色空格
        this.enemyGridGraphics.lineStyle(1, PALETTE.GOLD_DEEP, 0.6);
        this.enemyGridGraphics.strokeRect(cx - cellSize / 2, cy - cellSize / 2, cellSize, cellSize);
      } else {
        // 存活：亮金實心
        this.enemyGridGraphics.fillStyle(PALETTE.GOLD_3, 1);
        this.enemyGridGraphics.fillRect(cx - cellSize / 2, cy - cellSize / 2, cellSize, cellSize);
        this.enemyGridGraphics.lineStyle(1, PALETTE.GOLD, 1);
        this.enemyGridGraphics.strokeRect(cx - cellSize / 2, cy - cellSize / 2, cellSize, cellSize);
      }
    }
  }

  // ==========================================
  // UI 控制
  // ==========================================

  /**
   * 切換 UI 顯示/隱藏（HUD 條）
   */
  toggleUI() {
    this.uiVisible = !this.uiVisible;

    // 切換所有 UI 元素的可見性，帶有漸變動畫
    // 注意：rectangle 使用獨立 alpha；graphics 也支援 alpha；text 同樣
    this.uiElements.forEach((element) => {
      // 對於原本就是半透明的條形背景，需保留其 baseAlpha
      const targetAlpha = this.uiVisible ? (element.__baseAlpha != null ? element.__baseAlpha : 1) : 0;
      this.tweens.add({
        targets: element,
        alpha: targetAlpha,
        duration: 200,
        ease: 'Power2'
      });
    });

    const message = this.uiVisible ? 'HUD 已顯示' : 'HUD 已隱藏';
    this.showToggleMessage(message);
  }

  /**
   * 顯示切換訊息
   */
  showToggleMessage(message) {
    // 如果已有提示訊息，先清除
    if (this.toggleMessage) {
      this.toggleMessage.destroy();
    }

    // 創建提示訊息（顯示於可玩區域底部上方）
    this.toggleMessage = this.add.text(
      GAME_CONFIG.WIDTH / 2,
      GAME_CONFIG.PLAY_OFFSET_Y + GAME_CONFIG.PLAY_HEIGHT - 50,
      message,
      {
        fontFamily: 'Courier New, monospace',
        fontSize: '20px',
        fontStyle: 'bold',
        fill: '#FFCC00',
        stroke: '#000000',
        strokeThickness: 3,
        backgroundColor: '#000000',
        padding: { x: 15, y: 8 }
      }
    );
    this.toggleMessage.setOrigin(0.5);
    this.toggleMessage.setDepth(DEPTHS.UI + 1);
    this.toggleMessage.setScrollFactor(0);
    this.toggleMessage.setAlpha(0);

    // 淡入動畫
    this.tweens.add({
      targets: this.toggleMessage,
      alpha: 1,
      duration: 200,
      ease: 'Power2'
    });

    // 1.5 秒後淡出並銷毀
    this.time.delayedCall(1500, () => {
      if (this.toggleMessage) {
        this.tweens.add({
          targets: this.toggleMessage,
          alpha: 0,
          duration: 300,
          ease: 'Power2',
          onComplete: () => {
            if (this.toggleMessage) {
              this.toggleMessage.destroy();
              this.toggleMessage = null;
            }
          }
        });
      }
    });
  }

  /**
   * 顯示道具獲取提示
   * @param {string} powerUpType - 道具類型
   */
  showPowerUpMessage(powerUpType) {
    const config = POWERUP_TYPES[powerUpType];
    if (!config) return;

    // 構建道具名稱的中文對照
    const powerUpNames = {
      'HELMET': '頭盔',
      'GRENADE': '手榴彈',
      'CLOCK': '時鐘',
      'TANK': '坦克',
      'STAR': '星星',
      'SHOVEL': '鐵鍬'
    };

    const name = powerUpNames[powerUpType] || powerUpType;
    const description = config.description;

    // 構建完整訊息
    let message = `獲得道具：${name}`;

    // 特殊處理：星星升級顯示等級資訊
    if (powerUpType === 'STAR' && this.player && this.player.starLevel) {
      const starLevel = this.player.starLevel;
      const starEffects = {
        1: '移動速度提升',
        2: '可發射 2 顆子彈',
        3: '子彈可破壞鋼牆',
        4: '裝甲坦克！最大火力'
      };
      message += `\n⭐ Level ${starLevel}：${starEffects[starLevel]}`;
    } else if (config.duration > 0) {
      message += `\n${description}（${config.duration / 1000}秒）`;
    } else if (config.duration === 0 && powerUpType !== 'TANK') {
      message += `\n${description}（立即生效）`;
    } else {
      message += `\n${description}`;
    }

    // 如果已有道具提示訊息，先清除
    if (this.powerUpMessage) {
      this.powerUpMessage.destroy();
    }

    // 創建道具提示訊息（可玩區域上方置中顯示）
    this.powerUpMessage = this.add.text(
      GAME_CONFIG.WIDTH / 2,
      GAME_CONFIG.PLAY_OFFSET_Y + 36,
      message,
      {
        fontFamily: 'Courier New, monospace',
        fontSize: '22px',
        fontStyle: 'bold',
        fill: '#00FF00',
        stroke: '#000000',
        strokeThickness: 4,
        backgroundColor: '#000000DD',
        padding: { x: 20, y: 12 },
        align: 'center'
      }
    );
    this.powerUpMessage.setOrigin(0.5);
    this.powerUpMessage.setDepth(DEPTHS.UI + 2);
    this.powerUpMessage.setScrollFactor(0);
    this.powerUpMessage.setAlpha(0);

    // 淡入動畫 + 輕微彈跳效果
    this.tweens.add({
      targets: this.powerUpMessage,
      alpha: 1,
      y: GAME_CONFIG.PLAY_OFFSET_Y + 56,
      duration: 300,
      ease: 'Back.easeOut'
    });

    // 2.5 秒後淡出並銷毀
    this.time.delayedCall(2500, () => {
      if (this.powerUpMessage) {
        this.tweens.add({
          targets: this.powerUpMessage,
          alpha: 0,
          y: GAME_CONFIG.PLAY_OFFSET_Y + 36,
          duration: 300,
          ease: 'Power2',
          onComplete: () => {
            if (this.powerUpMessage) {
              this.powerUpMessage.destroy();
              this.powerUpMessage = null;
            }
          }
        });
      }
    });
  }

  // ==========================================
  // 輸入處理
  // ==========================================

  setupInput() {
    // 鍵盤輸入
    this.cursors = this.input.keyboard.createCursorKeys();
    this.fireKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.pauseKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    this.toggleUIKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);

    // 暫停
    this.pauseKey.on('down', () => {
      this.scene.pause();
      this.scene.launch(SCENES.PAUSE);
    });

    // 切換 UI 顯示（按 Tab 鍵）
    this.toggleUIKey.on('down', () => {
      this.toggleUI();
    });
  }

  // ==========================================
  // 敵人生成管理
  // ==========================================

  startEnemySpawning() {
    this.enemyQueue = [];

    // 建立敵人佇列
    this.levelData.enemyWaves.forEach(wave => {
      for (let i = 0; i < wave.count; i++) {
        this.enemyQueue.push(wave.type);
      }
    });

    // 洗牌
    this.enemyQueue.sort(() => Math.random() - 0.5);

    // 記錄最大同時敵人數
    this.maxEnemiesOnScreen = this.levelData.specialRules?.maxEnemiesOnScreen || 3;

    // 開始生成
    this.spawnNextEnemy();
  }

  spawnNextEnemy() {
    if (this.enemyQueue.length === 0) return;

    // 檢查同時敵人數限制
    const activeEnemies = this.enemies.getChildren().filter(e => e.active).length;
    if (activeEnemies >= this.maxEnemiesOnScreen) {
      // 等待 500ms 後重試
      this.time.delayedCall(500, () => this.spawnNextEnemy());
      return;
    }

    const type = this.enemyQueue.shift();
    const spawnData = Phaser.Utils.Array.GetRandom(this.levelData.enemySpawns);

    const tileSize = GAME_CONFIG.TILE_SIZE;
    const worldX = spawnData.x * tileSize + tileSize / 2;
    const worldY = spawnData.y * tileSize + tileSize / 2 + GAME_CONFIG.PLAY_OFFSET_Y;

    const enemy = new EnemyTank(this, worldX, worldY, type);
    const ai = new EnemyAI(this, enemy);
    enemy.setAI(ai);

    this.enemies.add(enemy);
    this.collisionSystem.addEnemy(enemy);

    // 繼續生成下一個
    if (this.enemyQueue.length > 0) {
      this.time.delayedCall(3000, () => this.spawnNextEnemy());
    }
  }

  // ==========================================
  // 遊戲物件創建（子彈、道具）
  // ==========================================

  createBullet(x, y, direction, speed, damage, owner) {
    const bullet = this.bulletPool.get();

    // 重要：先加入群組（bulletGroup 會創建 physics body）
    this.bullets.add(bullet);
    this.collisionSystem.addBullet(bullet);  // 這裡 bulletGroup.add() 會創建 body

    // 然後再發射（此時 body 已存在）
    bullet.fire(x, y, direction, speed, damage, owner);

    return bullet;
  }

  spawnPowerUp(x, y, type) {
    // 隨機選擇道具類型（如果沒指定）
    if (!type) {
      const types = ['TANK', 'STAR', 'HELMET', 'SHOVEL', 'CLOCK', 'GRENADE'];
      type = Phaser.Utils.Array.GetRandom(types);
    }

    const powerUp = new PowerUp(this, x, y, type);
    this.powerUps.add(powerUp);
    this.collisionSystem.addPowerUp(powerUp);
  }

  activateBaseProtection(duration) {
    if (!this.base || this.base.isDestroyed) return;

    // 防護中重複拾取：只重設計時器（鋼牆已存在，原牆紀錄保留第一次的）
    // 不可重建牆，否則會把第一次的鋼牆誤存成「原牆」、原磚牆紀錄遺失
    if (this.gameState.baseProtected) {
      if (this.baseProtectionTimer) {
        this.baseProtectionTimer.remove(false);
      }
      this.baseProtectionTimer = this.time.delayedCall(duration, () => this._endBaseProtection());
      return;
    }

    this.gameState.baseProtected = true;

    // 建立防護牆（鋼牆）
    const basePos = this.levelData.basePosition;
    const tileSize = GAME_CONFIG.TILE_SIZE;
    this.baseProtectionWalls = [];
    this.savedBaseWalls = []; // 保存原本的牆

    // 基地周圍一圈變成鋼牆
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue; // 跳過基地本身

        const mapX = basePos.x + dx;
        const mapY = basePos.y + dy;
        const worldX = mapX * tileSize + tileSize / 2;
        const worldY = mapY * tileSize + tileSize / 2 + GAME_CONFIG.PLAY_OFFSET_Y;

        // 查找並移除原本的牆
        const existingWall = this.collisionSystem.wallGroup.getChildren().find(wall =>
          wall.active &&
          Math.abs(wall.x - worldX) < 1 &&
          Math.abs(wall.y - worldY) < 1
        );

        if (existingWall) {
          // 保存原牆資訊以便恢復（type: 'brick' / 'steel' / 'water'）
          this.savedBaseWalls.push({
            x: worldX,
            y: worldY,
            type: existingWall.type
          });
          existingWall.destroy(); // 移除原本的牆
        }

        // 創建鋼牆（並同步地圖資料）
        const steel = new SteelWall(this, worldX, worldY);
        this.collisionSystem.addWall(steel);
        this.setMapTileAt(worldX, worldY, TILE_TYPES.STEEL);
        this.baseProtectionWalls.push(steel);
      }
    }

    // 持續時間結束後移除鋼牆並恢復原牆
    this.baseProtectionTimer = this.time.delayedCall(duration, () => this._endBaseProtection());
  }

  /**
   * 結束基地防護：移除防護鋼牆並恢復原本的牆
   * @private
   */
  _endBaseProtection() {
    this.gameState.baseProtected = false;
    this.baseProtectionTimer = null;

    // 移除鋼牆
    if (this.baseProtectionWalls) {
      this.baseProtectionWalls.forEach(wall => {
        if (wall.active) wall.destroy();
      });
      this.baseProtectionWalls = [];
    }

    // 依原類型恢復牆壁（並同步地圖資料）
    if (this.savedBaseWalls) {
      const wallFactories = {
        brick: { create: (x, y) => new BrickWall(this, x, y), tile: TILE_TYPES.BRICK },
        steel: { create: (x, y) => new SteelWall(this, x, y), tile: TILE_TYPES.STEEL },
        water: { create: (x, y) => new Water(this, x, y), tile: TILE_TYPES.WATER }
      };

      this.savedBaseWalls.forEach(wallInfo => {
        const factory = wallFactories[wallInfo.type];
        if (factory) {
          const wall = factory.create(wallInfo.x, wallInfo.y);
          this.collisionSystem.addWall(wall);
          this.setMapTileAt(wallInfo.x, wallInfo.y, factory.tile);
        }
      });
      this.savedBaseWalls = [];
    }
  }

  // ==========================================
  // 遊戲事件處理
  // ==========================================

  respawnPlayer() {
    if (!this.player || this.player.lives <= 0) return;

    // 重置玩家狀態
    const spawn = this.levelData.playerSpawn;
    const safeSpawn = this.findSafeSpawnPosition(spawn.x, spawn.y);
    const tileSize = GAME_CONFIG.TILE_SIZE;
    const worldX = safeSpawn.x * tileSize + tileSize / 2;
    const worldY = safeSpawn.y * tileSize + tileSize / 2 + GAME_CONFIG.PLAY_OFFSET_Y;

    // 建立新的玩家坦克
    this.player = new PlayerTank(this, worldX, worldY);
    this.player.lives = this.gameState.lives;
    this.player.score = this.gameState.score;
    this.collisionSystem.addPlayer(this.player);
  }

  onEnemyDestroyed(enemy) {
    this.gameState.enemiesRemaining--;
    this.gameState.enemiesKilled++;
    this.updateEnemies();

    // 經典模式：第 4、11、18 輛敵人掉落道具
    const powerUpTriggers = [4, 11, 18];
    if (powerUpTriggers.includes(this.gameState.enemiesKilled)) {
      const pos = this.getRandomEmptyPosition();

      if (pos) {
        const tileSize = GAME_CONFIG.TILE_SIZE;
        const worldX = pos.x * tileSize + tileSize / 2;
        const worldY = pos.y * tileSize + tileSize / 2 + GAME_CONFIG.PLAY_OFFSET_Y;
        // 不指定類型，讓 spawnPowerUp 隨機選擇
        this.spawnPowerUp(worldX, worldY);

        console.log(`💎 道具掉落！第 ${this.gameState.enemiesKilled} 個敵人被擊毀`);
      }
    }

    // 檢查關卡是否完成
    if (this.gameState.enemiesRemaining <= 0 && this.enemyQueue.length === 0) {
      this.levelComplete();
    }
  }

  getRandomEmptyPosition() {
    const map = this.levelData.map;
    const emptyPositions = [];

    // 掃描地圖找出所有安全的空位置
    for (let y = 2; y < map.length - 2; y++) {
      for (let x = 2; x < map[0].length - 2; x++) {
        if (this.isPositionSafe(x, y, map)) {
          emptyPositions.push({ x, y });
        }
      }
    }

    // 如果找到空位置，隨機選擇一個
    if (emptyPositions.length > 0) {
      return Phaser.Utils.Array.GetRandom(emptyPositions);
    }

    // 找不到空位置時，返回地圖中央
    console.warn('⚠️ 找不到空位置生成道具，使用中央位置');
    return { x: 13, y: 13 };
  }

  onPlayerDestroyed(isGameOver) {
    this.gameState.lives = this.player ? this.player.lives : 0;

    if (isGameOver) {
      this.gameOver();
    }
  }

  // ==========================================
  // UI 更新方法
  // ==========================================

  updateScore(score) {
    this.gameState.score = score;
    if (this.scoreText) {
      this.scoreText.setText(formatScore(score));
    }
    // 達到舊高分時更新顯示（避免 HI 比 SCORE 還低）
    if (this.hiScoreText && score > (this.highScore || 0)) {
      this.highScore = score;
      this.hiScoreText.setText(formatScore(score));
      this.hiScoreText.setColor(HEX.GOLD_2);
    }
  }

  updateLives(lives) {
    this.gameState.lives = lives;
    this.renderLives(lives);
  }

  updateEnemies() {
    this.renderEnemyGrid();

    // 擊殺數同步顯示於底部狀態條
    if (this.killsText) {
      this.killsText.setText(`KILLS · ${this.gameState.enemiesKilled || 0}`);
    }
  }

  updateLevel(level) {
    if (this.stageChipText) {
      this.stageChipText.setText(`STAGE ${formatStage(level)}`);
    }
  }

  // ==========================================
  // 遊戲狀態轉換
  // ==========================================

  levelComplete() {
    this.scene.start(SCENES.LEVEL_COMPLETE, {
      score: this.player ? this.player.score : this.gameState.score,
      level: this.currentLevel,
      lives: this.player ? this.player.lives : this.gameState.lives,
      starLevel: this.player ? this.player.starLevel : 0
    });
  }

  gameOver() {
    const finalScore = this.player ? this.player.score : this.gameState.score;

    // 更新最高分
    const isNewHighScore = this.saveManager.updateHighScore(finalScore);

    // 更新統計
    this.saveManager.updateStatistics({
      enemiesDestroyed: this.gameState.enemiesKilled || 0
    });

    this.scene.start(SCENES.GAME_OVER, {
      score: finalScore,
      level: this.currentLevel,
      isNewHighScore: isNewHighScore
    });
  }

  // ==========================================
  // 視覺效果方法
  // ==========================================

  createExplosion(x, y) {
    // 播放爆炸音效
    if (this.audioManager && this.audioManager.playSFX) {
      this.audioManager.playSFX('explosion', 0.6);
    }

    // 創建多層爆炸效果，更像經典坦克大戰
    const colors = [0xFF6600, 0xFF9900, 0xFFCC00, 0xFFFFFF];
    const sizes = [24, 20, 16, 12];

    colors.forEach((color, index) => {
      const explosion = this.add.circle(x, y, sizes[index], color);
      explosion.setDepth(DEPTHS.EFFECT);
      explosion.setAlpha(0.9);

      this.tweens.add({
        targets: explosion,
        scale: 2.5 - index * 0.3,
        alpha: 0,
        duration: 400 - index * 50,
        delay: index * 50,
        ease: 'Power2',
        onComplete: () => explosion.destroy()
      });
    });

    // 添加爆炸粒子
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 / 8) * i;
      const distance = 30;
      const particleX = x + Math.cos(angle) * 5;
      const particleY = y + Math.sin(angle) * 5;

      const particle = this.add.rectangle(particleX, particleY, 4, 4, 0xFFAA00);
      particle.setDepth(DEPTHS.EFFECT);

      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        duration: 300,
        ease: 'Power2',
        onComplete: () => particle.destroy()
      });
    }
  }

  createHitEffect(x, y) {
    // 播放擊中音效
    if (this.audioManager && this.audioManager.playSFX) {
      this.audioManager.playSFX('hit', 0.4);
    }

    // 改進擊中特效：閃光 + 小爆裂
    const colors = [0xFFFFFF, 0xFFFF00, 0xFFAA00];

    colors.forEach((color, index) => {
      const hit = this.add.circle(x, y, 8 - index * 2, color);
      hit.setDepth(DEPTHS.EFFECT);

      this.tweens.add({
        targets: hit,
        scale: 2,
        alpha: 0,
        duration: 150 - index * 30,
        delay: index * 20,
        ease: 'Power2',
        onComplete: () => hit.destroy()
      });
    });

    // 添加擊中火花
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI * 2 / 4) * i + Math.PI / 4;
      const spark = this.add.rectangle(x, y, 2, 6, 0xFFFF00);
      spark.setDepth(DEPTHS.EFFECT);
      spark.setRotation(angle);

      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * 15,
        y: y + Math.sin(angle) * 15,
        alpha: 0,
        duration: 200,
        ease: 'Power2',
        onComplete: () => spark.destroy()
      });
    }
  }

  createSpark(x, y) {
    const spark = this.add.circle(x, y, 5, 0xFFFFFF);
    spark.setDepth(DEPTHS.EFFECT);

    this.tweens.add({
      targets: spark,
      alpha: 0,
      duration: 150,
      onComplete: () => spark.destroy()
    });
  }

  createCollectEffect(x, y) {
    const effect = this.add.circle(x, y, 16, 0x00FF00);
    effect.setDepth(DEPTHS.EFFECT);

    this.tweens.add({
      targets: effect,
      scale: 2,
      alpha: 0,
      duration: 400,
      onComplete: () => effect.destroy()
    });
  }

  // ==========================================
  // 道具效果方法
  // ==========================================

  destroyAllEnemies() {
    this.enemies.getChildren().forEach(enemy => {
      if (enemy.active && !enemy.isDestroyed) {
        // 使用 takeDamage 而不是直接 destroy，確保觸發正確的事件流程
        // 這樣會觸發 ENEMY_DESTROYED 事件，更新計數器
        enemy.takeDamage(9999);
      }
    });
  }

  freezeAllEnemies(duration) {
    this.enemies.getChildren().forEach(enemy => {
      if (enemy.active) {
        enemy.setFrozen(duration);
      }
    });
  }

  // ==========================================
  // 遊戲循環與更新
  // ==========================================

  update(time, delta) {
    // 更新 AI 黑板
    if (this.aiBlackboard) {
      this.aiBlackboard.update();
    }

    // 更新底部時間顯示（每 ~250ms 更新一次以節省繪製）
    if (this.timerText && this.gameStartTime != null) {
      if (!this._lastTimerTick || time - this._lastTimerTick > 250) {
        const elapsed = time - this.gameStartTime;
        const totalSec = Math.max(0, Math.floor(elapsed / 1000));
        const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
        const s = String(totalSec % 60).padStart(2, '0');
        this.timerText.setText(`TIME · ${m}:${s}`);
        this._lastTimerTick = time;
      }
    }

    // 更新玩家
    if (this.player && this.player.active) {
      this.handlePlayerInput();
      this.player.update(time, delta);
    }

    // 更新敵人
    this.enemies.getChildren().forEach(enemy => {
      if (enemy.active) {
        enemy.update(time, delta);
      }
    });

    // 更新地形效果
    this.updateTerrainEffects();

    // 清理無效子彈
    // getChildren() 回傳內部陣列，迭代中 remove 會跳過元素，先複製
    const bullets = [...this.bullets.getChildren()];
    bullets.forEach(bullet => {
      if (!bullet.active) {
        this.bulletPool.release(bullet);
        this.bullets.remove(bullet, false, false);
      }
    });
  }

  handlePlayerInput() {
    let moveDirection = null;

    if (this.cursors.up.isDown) {
      moveDirection = 'up';
    } else if (this.cursors.down.isDown) {
      moveDirection = 'down';
    } else if (this.cursors.left.isDown) {
      moveDirection = 'left';
    } else if (this.cursors.right.isDown) {
      moveDirection = 'right';
    }

    if (moveDirection) {
      this.player.move(moveDirection);
      this.applyCornerSlide(this.player, moveDirection);
    } else {
      this.player.stop();
    }

    if (Phaser.Input.Keyboard.JustDown(this.fireKey)) {
      this.player.shoot();
    }
  }

  /**
   * 轉角滑動輔助：移動時將坦克往通道中心線微調
   * 26px 車身過 32px 縫隙需要 ±3px 對準精度，沒有輔助時極易卡在牆角
   * @param {Tank} tank - 坦克
   * @param {string} direction - 移動方向
   */
  applyCornerSlide(tank, direction) {
    const map = this.levelData && this.levelData.map;
    const slide = GridMovement.calculateCornerSlide(tank, direction, map);

    if (slide) {
      if (slide.axis === 'x') {
        tank.x += slide.amount;
      } else {
        tank.y += slide.amount;
      }
    }
  }

  /**
   * 更新地形效果
   * 處理冰地滑行和森林遮蔽效果
   */
  updateTerrainEffects() {
    // 收集所有坦克
    const tanks = [];
    if (this.player && this.player.active) {
      tanks.push(this.player);
    }
    this.enemies.getChildren().forEach(enemy => {
      if (enemy.active) {
        tanks.push(enemy);
      }
    });

    // 進出判定必須先聚合「所有」地形 tile 的重疊結果再執行一次：
    // 逐 tile 判定時，站在 A 冰塊上但迭代到不重疊的 B 冰塊會被誤判離開，
    // 同一幀內 enter/exit 互踩，最終狀態取決於 tile 迭代順序
    const iceTiles = this.iceTerrains.getChildren();
    const forestTiles = this.forestTerrains.getChildren();

    tanks.forEach(tank => {
      // 冰地滑行效果
      const touchingIce = iceTiles.find(ice => ice.isOverlapping(tank));
      if (touchingIce && !tank.onIce) {
        touchingIce.onTankEnter(tank);
      } else if (!touchingIce && tank.onIce && iceTiles.length > 0) {
        iceTiles[0].onTankExit(tank);
      }

      // 森林遮蔽效果
      const touchingForest = forestTiles.find(forest => forest.isOverlapping(tank));
      if (touchingForest && !tank.inForest) {
        touchingForest.onTankEnter(tank);
      } else if (!touchingForest && tank.inForest && forestTiles.length > 0) {
        forestTiles[0].onTankExit(tank);
      }
    });
  }

  // ==========================================
  // 場景清理
  // ==========================================

  shutdown() {
    // 清理事件監聽
    this.events.off(EVENTS.PLAYER_DESTROYED);
    this.events.off(EVENTS.ENEMY_DESTROYED);
    this.events.off(EVENTS.SCORE_CHANGED);
    this.events.off(EVENTS.LIVES_CHANGED);

    // 清理物件池
    if (this.bulletPool) {
      this.bulletPool.clear();
    }

    // 清理 AI 黑板
    if (this.aiBlackboard) {
      this.aiBlackboard.clear();
    }
  }
}
