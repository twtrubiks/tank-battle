/**
 * 牆壁與地圖資料同步測試
 * 牆壁實體被摧毀時必須同步更新 levelData.map，
 * 否則 AI 走位判斷與尋路會把已轟穿的通道當成牆
 */

import BrickWall from '../../src/entities/BrickWall';
import SteelWall from '../../src/entities/SteelWall';
import GameScene from '../../src/scenes/GameScene';
import { TILE_TYPES, GAME_CONFIG } from '../../src/utils/Constants';

describe('牆壁與地圖資料同步', () => {
  describe('BrickWall', () => {
    let mockScene;

    beforeEach(() => {
      mockScene = {
        add: { existing: jest.fn() },
        setMapTileAt: jest.fn()
      };
    });

    test('磚牆被摧毀時應該將該格設為空地', () => {
      const wall = new BrickWall(mockScene, 80, 108);
      wall.takeDamage(1);

      expect(mockScene.setMapTileAt).toHaveBeenCalledWith(80, 108, TILE_TYPES.EMPTY);
      expect(wall.active).toBe(false);
    });

    test('磚牆未被摧毀時不應該更新地圖', () => {
      const wall = new BrickWall(mockScene, 80, 108);
      wall.health = 2;
      wall.takeDamage(1);

      expect(mockScene.setMapTileAt).not.toHaveBeenCalled();
      expect(wall.active).toBe(true);
    });
  });

  describe('SteelWall', () => {
    let mockScene;

    beforeEach(() => {
      mockScene = {
        add: { existing: jest.fn() },
        setMapTileAt: jest.fn()
      };
    });

    test('鋼牆被強化子彈（damage >= 2）摧毀時應該將該格設為空地', () => {
      const wall = new SteelWall(mockScene, 144, 172);
      wall.takeDamage(2);

      expect(mockScene.setMapTileAt).toHaveBeenCalledWith(144, 172, TILE_TYPES.EMPTY);
      expect(wall.active).toBe(false);
    });

    test('鋼牆不應該被普通子彈摧毀', () => {
      const wall = new SteelWall(mockScene, 144, 172);
      wall.takeDamage(1);

      expect(mockScene.setMapTileAt).not.toHaveBeenCalled();
      expect(wall.active).toBe(true);
    });
  });

  describe('GameScene.setMapTileAt', () => {
    let scene;
    const tileSize = GAME_CONFIG.TILE_SIZE;
    const offsetY = GAME_CONFIG.PLAY_OFFSET_Y;

    beforeEach(() => {
      scene = new GameScene();
      scene.levelData = {
        map: Array(26).fill(null).map(() => Array(26).fill(TILE_TYPES.BRICK))
      };
    });

    test('應該正確將世界座標轉為格子並更新地形', () => {
      // 格子 (2, 3) 的中心點
      const worldX = 2 * tileSize + tileSize / 2;
      const worldY = 3 * tileSize + tileSize / 2 + offsetY;

      scene.setMapTileAt(worldX, worldY, TILE_TYPES.EMPTY);

      expect(scene.levelData.map[3][2]).toBe(TILE_TYPES.EMPTY);
    });

    test('超出邊界的座標不應該造成錯誤', () => {
      expect(() => {
        scene.setMapTileAt(-100, -100, TILE_TYPES.EMPTY);
        scene.setMapTileAt(10000, 10000, TILE_TYPES.EMPTY);
      }).not.toThrow();
    });

    test('沒有地圖資料時不應該造成錯誤', () => {
      scene.levelData = null;

      expect(() => {
        scene.setMapTileAt(100, 100, TILE_TYPES.EMPTY);
      }).not.toThrow();
    });
  });

  describe('GameScene.loadLevel - 關卡資料深拷貝', () => {
    test('載入的關卡資料不應該與 Phaser JSON cache 共享參照', () => {
      const cachedLevel = {
        levelNumber: 1,
        enemyWaves: [{ type: 'BASIC', count: 5 }],
        map: Array(26).fill(null).map(() => Array(26).fill(TILE_TYPES.EMPTY))
      };
      cachedLevel.map[5][5] = TILE_TYPES.BRICK;

      const scene = new GameScene();
      scene.currentLevel = 1;
      scene.gameState = {};
      scene.cache = {
        json: {
          exists: () => true,
          get: () => cachedLevel
        }
      };

      scene.loadLevel();

      expect(scene.levelData).not.toBe(cachedLevel);
      expect(scene.levelData.map).not.toBe(cachedLevel.map);

      // 修改 runtime 地圖（例如磚牆被摧毀）不應該污染 cache
      scene.levelData.map[5][5] = TILE_TYPES.EMPTY;
      expect(cachedLevel.map[5][5]).toBe(TILE_TYPES.BRICK);
    });
  });
});
