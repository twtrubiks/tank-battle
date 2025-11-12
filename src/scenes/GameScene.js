/**
 * 主遊戲場景
 * 整合所有遊戲系統
 */

import Phaser from 'phaser';
import { SCENES, GAME_CONFIG, ENEMY_TYPES, EVENTS, DEPTHS, TILE_TYPES, POWERUP_TYPES } from '../utils/Constants';
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
    // 設定物理世界邊界（確保坦克不能超出畫面）
    this.physics.world.setBounds(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT);

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
      this.levelData = this.cache.json.get(levelKey);
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
    // 建立地圖背景
    const bg = this.add.rectangle(
      0, 0,
      GAME_CONFIG.WIDTH,
      GAME_CONFIG.HEIGHT,
      0x000000
    );
    bg.setOrigin(0, 0);
    bg.setDepth(DEPTHS.BACKGROUND);

    // 根據地圖資料建立地圖元素
    const map = this.levelData.map;
    const tileSize = GAME_CONFIG.TILE_SIZE;

    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        const tileType = map[y][x];
        const worldX = x * tileSize + tileSize / 2;
        const worldY = y * tileSize + tileSize / 2;

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

    // 建立邊框
    const graphics = this.add.graphics();
    graphics.lineStyle(4, 0x404040);
    graphics.strokeRect(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT);
    graphics.setDepth(DEPTHS.MAP_UPPER);
  }

  createBase() {
    // 從關卡資料取得基地位置
    const basePos = this.levelData.basePosition;
    const tileSize = GAME_CONFIG.TILE_SIZE;
    const worldX = basePos.x * tileSize + tileSize / 2;
    const worldY = basePos.y * tileSize + tileSize / 2;

    this.base = new Base(this, worldX, worldY);
    this.collisionSystem.addBase(this.base);
  }

  createPlayer() {
    const spawn = this.levelData.playerSpawn;
    const safeSpawn = this.findSafeSpawnPosition(spawn.x, spawn.y);
    const tileSize = GAME_CONFIG.TILE_SIZE;
    const worldX = safeSpawn.x * tileSize + tileSize / 2;
    const worldY = safeSpawn.y * tileSize + tileSize / 2;

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
    const hudStyle = {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      fontStyle: 'bold',
      fill: '#FFCC00',
      stroke: '#000000',
      strokeThickness: 2
    };

    const valueStyle = {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      fontStyle: 'bold',
      fill: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 2
    };

    // UI 背景面板（更精美的設計）
    const panelWidth = 220;
    const panelHeight = 160;
    const panelX = 10;
    const panelY = 10;

    // 面板背景
    const uiBg = this.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0x000000, 0.85);
    uiBg.setOrigin(0, 0);
    uiBg.setDepth(DEPTHS.UI);
    uiBg.setScrollFactor(0);
    this.uiElements.push(uiBg);

    // 面板邊框（金色雙線）
    const borderGraphics = this.add.graphics();
    borderGraphics.setDepth(DEPTHS.UI);
    borderGraphics.setScrollFactor(0);
    borderGraphics.lineStyle(3, 0xFFCC00);
    borderGraphics.strokeRect(panelX, panelY, panelWidth, panelHeight);
    borderGraphics.lineStyle(1, 0xFF8800);
    borderGraphics.strokeRect(panelX + 4, panelY + 4, panelWidth - 8, panelHeight - 8);
    this.uiElements.push(borderGraphics);

    // 標題
    const titleText = this.add.text(panelX + panelWidth / 2, panelY + 15, '═ 遊戲資訊 ═', {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      fontStyle: 'bold',
      fill: '#FFCC00',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5, 0).setDepth(DEPTHS.UI).setScrollFactor(0);
    this.uiElements.push(titleText);

    // 關卡顯示
    const levelY = panelY + 40;
    const levelLabel = this.add.text(panelX + 15, levelY, '關卡:', hudStyle)
      .setDepth(DEPTHS.UI).setScrollFactor(0);
    this.uiElements.push(levelLabel);

    this.levelText = this.add.text(panelX + 160, levelY, '1', valueStyle)
      .setDepth(DEPTHS.UI).setScrollFactor(0);
    this.uiElements.push(this.levelText);

    // 分數
    const scoreY = panelY + 65;
    const scoreLabel = this.add.text(panelX + 15, scoreY, '分數:', hudStyle)
      .setDepth(DEPTHS.UI).setScrollFactor(0);
    this.uiElements.push(scoreLabel);

    this.scoreText = this.add.text(panelX + 160, scoreY, '0', valueStyle)
      .setOrigin(1, 0).setDepth(DEPTHS.UI).setScrollFactor(0);
    this.uiElements.push(this.scoreText);

    // 生命值（使用坦克圖示）
    const livesY = panelY + 90;
    const livesLabel = this.add.text(panelX + 15, livesY, '生命:', hudStyle)
      .setDepth(DEPTHS.UI).setScrollFactor(0);
    this.uiElements.push(livesLabel);

    this.livesText = this.add.text(panelX + 160, livesY, '3', valueStyle)
      .setOrigin(1, 0).setDepth(DEPTHS.UI).setScrollFactor(0);
    this.uiElements.push(this.livesText);

    // 敵人剩餘
    const enemiesY = panelY + 115;
    const enemiesLabel = this.add.text(panelX + 15, enemiesY, '敵軍:', hudStyle)
      .setDepth(DEPTHS.UI).setScrollFactor(0);
    this.uiElements.push(enemiesLabel);

    this.enemiesText = this.add.text(panelX + 160, enemiesY, '0', valueStyle)
      .setOrigin(1, 0).setDepth(DEPTHS.UI).setScrollFactor(0);
    this.uiElements.push(this.enemiesText);

    // 添加小坦克圖示裝飾
    const tankIcon = this.add.sprite(panelX + 185, livesY + 10, 'player_tank');
    tankIcon.setScale(0.6);
    tankIcon.setDepth(DEPTHS.UI);
    tankIcon.setScrollFactor(0);
    this.uiElements.push(tankIcon);

    // 添加敵軍圖示裝飾
    const enemyIcon = this.add.sprite(panelX + 185, enemiesY + 10, 'enemy_basic');
    enemyIcon.setScale(0.6);
    enemyIcon.setDepth(DEPTHS.UI);
    enemyIcon.setScrollFactor(0);
    this.uiElements.push(enemyIcon);

    // Tab 鍵提示（底部小字提示）
    const tabHintY = panelY + panelHeight - 18;
    const tabHint = this.add.text(panelX + panelWidth / 2, tabHintY, '[Tab] 隱藏', {
      fontFamily: 'Courier New, monospace',
      fontSize: '12px',
      fill: '#888888',
      stroke: '#000000',
      strokeThickness: 1
    }).setOrigin(0.5, 0).setDepth(DEPTHS.UI).setScrollFactor(0);
    this.uiElements.push(tabHint);

    // 添加閃爍效果到面板（保存引用以便可以停止）
    this.borderTween = this.tweens.add({
      targets: borderGraphics,
      alpha: 0.7,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  // ==========================================
  // UI 控制
  // ==========================================

  /**
   * 切換 UI 顯示/隱藏
   */
  toggleUI() {
    this.uiVisible = !this.uiVisible;

    // 如果隱藏 UI，停止邊框閃爍動畫
    if (!this.uiVisible && this.borderTween) {
      this.borderTween.stop();
    }

    // 切換所有 UI 元素的可見性，帶有漸變動畫
    this.uiElements.forEach(element => {
      this.tweens.add({
        targets: element,
        alpha: this.uiVisible ? 1 : 0,
        duration: 200,
        ease: 'Power2'
      });
    });

    // 如果顯示 UI，重新啟動邊框閃爍動畫
    if (this.uiVisible && this.borderTween) {
      this.borderTween.restart();
    }

    // 顯示提示訊息
    const message = this.uiVisible ? 'UI 已顯示' : 'UI 已隱藏';
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

    // 創建提示訊息（置中顯示）
    this.toggleMessage = this.add.text(
      GAME_CONFIG.WIDTH / 2,
      GAME_CONFIG.HEIGHT - 50,
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

    // 創建道具提示訊息（螢幕上方置中顯示）
    this.powerUpMessage = this.add.text(
      GAME_CONFIG.WIDTH / 2,
      80,
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
      y: 100,
      duration: 300,
      ease: 'Back.easeOut'
    });

    // 2.5 秒後淡出並銷毀
    this.time.delayedCall(2500, () => {
      if (this.powerUpMessage) {
        this.tweens.add({
          targets: this.powerUpMessage,
          alpha: 0,
          y: 80,
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
    const worldY = spawnData.y * tileSize + tileSize / 2;

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

    this.gameState.baseProtected = true;

    // 建立防護牆（鋼牆）
    const basePos = this.levelData.basePosition;
    const tileSize = GAME_CONFIG.TILE_SIZE;
    this.baseProtectionWalls = [];
    this.savedBaseWalls = []; // 保存原本的磚牆

    // 基地周圍一圈變成鋼牆
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue; // 跳過基地本身

        const mapX = basePos.x + dx;
        const mapY = basePos.y + dy;
        const worldX = mapX * tileSize + tileSize / 2;
        const worldY = mapY * tileSize + tileSize / 2;

        // 查找並移除原本的磚牆
        const existingWall = this.collisionSystem.wallGroup.getChildren().find(wall =>
          wall.active &&
          Math.abs(wall.x - worldX) < 1 &&
          Math.abs(wall.y - worldY) < 1
        );

        if (existingWall) {
          // 保存磚牆信息以便恢復
          this.savedBaseWalls.push({
            x: worldX,
            y: worldY,
            type: existingWall.constructor.name // 'BrickWall' 或其他類型
          });
          existingWall.destroy(); // 移除原本的牆
        }

        // 創建鋼牆
        const steel = new SteelWall(this, worldX, worldY);
        this.collisionSystem.addWall(steel);
        this.baseProtectionWalls.push(steel);
      }
    }

    // 持續時間結束後移除鋼牆並恢復磚牆
    this.time.delayedCall(duration, () => {
      this.gameState.baseProtected = false;

      // 移除鋼牆
      if (this.baseProtectionWalls) {
        this.baseProtectionWalls.forEach(wall => {
          if (wall.active) wall.destroy();
        });
        this.baseProtectionWalls = [];
      }

      // 恢復原本的磚牆
      if (this.savedBaseWalls) {
        this.savedBaseWalls.forEach(wallInfo => {
          // 根據類型恢復磚牆
          if (wallInfo.type === 'BrickWall') {
            const wall = new BrickWall(this, wallInfo.x, wallInfo.y);
            this.collisionSystem.addWall(wall);
          }
        });
        this.savedBaseWalls = [];
      }
    });
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
    const worldY = safeSpawn.y * tileSize + tileSize / 2;

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
        const worldY = pos.y * tileSize + tileSize / 2;
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
    this.scoreText.setText(score.toString());
  }

  updateLives(lives) {
    this.gameState.lives = lives;
    this.livesText.setText(lives.toString());
  }

  updateEnemies() {
    this.enemiesText.setText(this.gameState.enemiesRemaining.toString());
  }

  updateLevel(level) {
    if (this.levelText) {
      this.levelText.setText(level.toString());
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
    this.bullets.getChildren().forEach(bullet => {
      if (!bullet.active) {
        this.bulletPool.release(bullet);
        this.bullets.remove(bullet, false, false);
      }
    });
  }

  handlePlayerInput() {
    if (this.cursors.up.isDown) {
      this.player.move('up');
    } else if (this.cursors.down.isDown) {
      this.player.move('down');
    } else if (this.cursors.left.isDown) {
      this.player.move('left');
    } else if (this.cursors.right.isDown) {
      this.player.move('right');
    } else {
      this.player.stop();
    }

    if (Phaser.Input.Keyboard.JustDown(this.fireKey)) {
      this.player.shoot();
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

    // 檢查冰地效果
    this.iceTerrains.getChildren().forEach(ice => {
      tanks.forEach(tank => {
        if (ice.isOverlapping(tank)) {
          if (!tank.onIce) {
            ice.onTankEnter(tank);
          }
        } else {
          if (tank.onIce) {
            ice.onTankExit(tank);
          }
        }
      });
    });

    // 檢查森林遮蔽效果
    this.forestTerrains.getChildren().forEach(forest => {
      tanks.forEach(tank => {
        if (forest.isOverlapping(tank)) {
          if (!tank.inForest) {
            forest.onTankEnter(tank);
          }
        } else {
          if (tank.inForest) {
            forest.onTankExit(tank);
          }
        }
      });
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
  }
}
