/**
 * 遊戲常數定義
 */

// 遊戲畫布設定
export const GAME_CONFIG = {
  WIDTH: 832,           // 26 * 32 (26 格，每格 32px)
  HEIGHT: 832,
  TILE_SIZE: 32,
  MAP_SIZE: 26
};

// 坦克配置
export const TANK_CONFIG = {
  // 玩家坦克
  PLAYER_SPEED: 120,
  PLAYER_FIRE_RATE: 500,
  PLAYER_MAX_BULLETS: 2,
  PLAYER_LIVES: 3,

  // 敵人坦克速度
  ENEMY_SPEED_SLOW: 60,
  ENEMY_SPEED_NORMAL: 80,
  ENEMY_SPEED_FAST: 120,

  // 坦克尺寸
  TANK_SIZE: 32,
  TANK_BODY_SIZE: 28,
  TANK_BODY_OFFSET: 2
};

// 敵人類型配置
export const ENEMY_TYPES = {
  BASIC: {
    key: 'BASIC',
    texture: 'enemy_basic',
    health: 1,
    speed: 60,
    fireRate: 2000,
    score: 100,
    bulletSpeed: 150,
    color: 0xAAAAAA
  },
  FAST: {
    key: 'FAST',
    texture: 'enemy_fast',
    health: 1,
    speed: 120,
    fireRate: 1500,
    score: 200,
    bulletSpeed: 200,
    color: 0xFF6B6B
  },
  POWER: {
    key: 'POWER',
    texture: 'enemy_power',
    health: 2,
    speed: 80,
    fireRate: 1000,
    score: 300,
    bulletSpeed: 180,
    color: 0xFFD93D
  },
  ARMOR: {
    key: 'ARMOR',
    texture: 'enemy_armor',
    health: 4,
    speed: 60,
    fireRate: 1800,
    score: 400,
    bulletSpeed: 150,
    color: 0x6BCB77
  }
};

// 子彈配置
export const BULLET_CONFIG = {
  SPEED: 200,
  DAMAGE: 1,
  SIZE: 8,
  PLAYER_COLOR: 0xFFFF00,
  ENEMY_COLOR: 0xFF0000
};

// 道具類型
export const POWERUP_TYPES = {
  TANK: {
    key: 'TANK',
    texture: 'powerup_tank',
    duration: 0,          // 永久效果
    description: '額外生命'
  },
  STAR: {
    key: 'STAR',
    texture: 'powerup_star',
    duration: 0,          // 永久效果（累積升級）
    description: '坦克升級'
  },
  GRENADE: {
    key: 'GRENADE',
    texture: 'powerup_grenade',
    duration: 0,          // 立即效果
    description: '消滅所有敵人'
  },
  SHOVEL: {
    key: 'SHOVEL',
    texture: 'powerup_shovel',
    duration: 15000,      // 15 秒
    description: '基地防護'
  },
  HELMET: {
    key: 'HELMET',
    texture: 'powerup_helmet',
    duration: 10000,      // 10 秒
    description: '無敵護盾'
  },
  CLOCK: {
    key: 'CLOCK',
    texture: 'powerup_clock',
    duration: 8000,       // 8 秒
    description: '冰凍敵人'
  }
};

// 地圖元素類型
export const TILE_TYPES = {
  EMPTY: 0,
  BRICK: 1,
  STEEL: 2,
  WATER: 3,
  ICE: 4,
  FOREST: 5,
  BASE: 6
};

// 方向常數
export const DIRECTIONS = {
  UP: 'up',
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right'
};

// 方向對應的角度
export const DIRECTION_ANGLES = {
  [DIRECTIONS.UP]: 0,
  [DIRECTIONS.DOWN]: 180,
  [DIRECTIONS.LEFT]: 270,
  [DIRECTIONS.RIGHT]: 90
};

// 方向對應的速度向量
export const DIRECTION_VECTORS = {
  [DIRECTIONS.UP]: { x: 0, y: -1 },
  [DIRECTIONS.DOWN]: { x: 0, y: 1 },
  [DIRECTIONS.LEFT]: { x: -1, y: 0 },
  [DIRECTIONS.RIGHT]: { x: 1, y: 0 }
};

// 音效鍵值
export const AUDIO_KEYS = {
  BGM_MENU: 'bgm_menu',
  BGM_GAME: 'bgm_game',
  SFX_SHOOT: 'sfx_shoot',
  SFX_EXPLOSION: 'sfx_explosion',
  SFX_HIT: 'sfx_hit',
  SFX_POWERUP: 'sfx_powerup',
  SFX_SPAWN: 'sfx_spawn',
  SFX_BASE_DESTROY: 'sfx_base_destroy',
  SFX_LEVEL_COMPLETE: 'sfx_level_complete',
  SFX_GAME_OVER: 'sfx_game_over'
};

// 顏色常數
export const COLORS = {
  WHITE: 0xFFFFFF,
  BLACK: 0x000000,
  RED: 0xFF0000,
  GREEN: 0x00FF00,
  BLUE: 0x0000FF,
  YELLOW: 0xFFFF00,
  ORANGE: 0xFF8800,
  GRAY: 0x808080
};

// 場景鍵值
export const SCENES = {
  BOOT: 'BootScene',
  PRELOAD: 'PreloadScene',
  MENU: 'MenuScene',
  GAME: 'GameScene',
  PAUSE: 'PauseScene',
  GAME_OVER: 'GameOverScene',
  LEVEL_COMPLETE: 'LevelCompleteScene'
};

// 深度層級（渲染順序）
export const DEPTHS = {
  BACKGROUND: 0,
  MAP_LOWER: 1,
  ENTITY: 2,
  MAP_UPPER: 3,
  EFFECT: 4,
  UI: 5
};

// 物件池配置
export const POOL_CONFIG = {
  BULLET_POOL_SIZE: 50,
  EXPLOSION_POOL_SIZE: 20,
  SPARK_POOL_SIZE: 30
};

// AI 配置
export const AI_CONFIG = {
  DETECTION_RANGE: 300,
  ATTACK_RANGE: 150,
  RETREAT_HEALTH_PERCENT: 0.3,
  STATE_CHANGE_COOLDOWN: 2000,

  // 分級卡住檢測閾值
  STUCK_DISTANCE: 5,
  STUCK_THRESHOLD_LIGHT: 30,   // 輕微卡住：0.5 秒（小幅調整）
  STUCK_THRESHOLD_MEDIUM: 60,  // 中度卡住：1.0 秒（改變方向）
  STUCK_THRESHOLD_SEVERE: 90,  // 嚴重卡住：1.5 秒（隨機逃脫）

  // 速度檢測（如果速度為 0 但應該在移動，視為卡住）
  STUCK_VELOCITY_THRESHOLD: 5  // 速度低於此值視為停止
};

// AI 難度設定
export const AI_DIFFICULTY = {
  EASY: {
    detectionRange: 200,
    attackRange: 100,
    fireRateMultiplier: 0.7,
    accuracyTolerance: 50
  },
  NORMAL: {
    detectionRange: 300,
    attackRange: 150,
    fireRateMultiplier: 1.0,
    accuracyTolerance: 30
  },
  HARD: {
    detectionRange: 400,
    attackRange: 200,
    fireRateMultiplier: 1.3,
    accuracyTolerance: 10
  }
};

// 遊戲狀態
export const GAME_STATES = {
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'game_over',
  LEVEL_COMPLETE: 'level_complete'
};

// 事件名稱
export const EVENTS = {
  PLAYER_HIT: 'player_hit',
  PLAYER_DESTROYED: 'player_destroyed',
  ENEMY_DESTROYED: 'enemy_destroyed',
  BASE_DESTROYED: 'base_destroyed',
  POWERUP_COLLECTED: 'powerup_collected',
  LEVEL_COMPLETE: 'level_complete',
  SCORE_CHANGED: 'score_changed',
  LIVES_CHANGED: 'lives_changed'
};

// 本地儲存鍵值
export const STORAGE_KEYS = {
  HIGH_SCORE: 'tank_battle_high_score',
  CURRENT_LEVEL: 'tank_battle_current_level',
  SETTINGS: 'tank_battle_settings'
};
