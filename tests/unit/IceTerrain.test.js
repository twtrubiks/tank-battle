/**
 * 冰地滑行測試（真實實作）
 * 冰上放開方向鍵時坦克應該滑行（由阻力自然減速），
 * 多塊冰地同時存在時進出旗標不可互踩
 */

import Tank from '../../src/entities/Tank';
import Ice from '../../src/entities/Ice';
import Forest from '../../src/entities/Forest';
import GameScene from '../../src/scenes/GameScene';
import { TANK_CONFIG } from '../../src/utils/Constants';

const makeMockScene = () => ({
  add: { existing: jest.fn() },
  physics: { add: { existing: jest.fn() } },
  time: { now: 1000, delayedCall: jest.fn() },
  tweens: { add: jest.fn() },
  bullets: { getChildren: () => [] }
});

describe('冰地滑行', () => {
  let scene;
  let tank;

  beforeEach(() => {
    scene = makeMockScene();
    tank = new Tank(scene, 100, 100, 'tank');
  });

  describe('Tank.stop - 冰上滑行', () => {
    test('一般地面停止時速度應該立即歸零', () => {
      tank.move('right');
      expect(tank.body.velocity.x).toBeGreaterThan(0);

      tank.stop();

      expect(tank.body.velocity.x).toBe(0);
      expect(tank.body.velocity.y).toBe(0);
    });

    test('冰上停止時應該保留速度（靠阻力滑行減速）', () => {
      tank.onIce = true;
      tank.move('right');
      const movingVelocity = tank.body.velocity.x;

      tank.stop();

      expect(tank.body.velocity.x).toBe(movingVelocity);
    });

    test('強制停止（冰凍）時冰上也應該立即歸零', () => {
      tank.onIce = true;
      tank.move('right');

      tank.stop(true);

      expect(tank.body.velocity.x).toBe(0);
    });

    test('冰凍效果應該強制停止冰上的坦克', () => {
      tank.onIce = true;
      tank.move('down');

      tank.setFrozen(1000);

      expect(tank.body.velocity.y).toBe(0);
    });
  });

  describe('Ice.onTankEnter / onTankExit', () => {
    test('進入冰地應該降低阻力並設定旗標', () => {
      const ice = new Ice(scene, 100, 100);

      ice.onTankEnter(tank);

      expect(tank.onIce).toBe(true);
      expect(tank.body.drag.x).toBe(TANK_CONFIG.ICE_DRAG);
    });

    test('離開冰地應該恢復一般阻力', () => {
      const ice = new Ice(scene, 100, 100);

      ice.onTankEnter(tank);
      ice.onTankExit(tank);

      expect(tank.onIce).toBe(false);
      expect(tank.body.drag.x).toBe(TANK_CONFIG.NORMAL_DRAG);
    });

    test('跨越多塊冰地時阻力不應該被污染', () => {
      const iceA = new Ice(scene, 100, 100);
      const iceB = new Ice(scene, 132, 100);

      // 先進入 A，再由 B 觸發進入（模擬跨 tile 移動）
      iceA.onTankEnter(tank);
      iceB.onTankEnter(tank);
      // 由任一 tile 觸發離開
      iceA.onTankExit(tank);

      // 必須恢復成一般阻力，而非另一塊冰記下的「已降低」值
      expect(tank.body.drag.x).toBe(TANK_CONFIG.NORMAL_DRAG);
    });
  });

  describe('GameScene.updateTerrainEffects - 多 tile 聚合', () => {
    /**
     * 建立带地形群組的場景替身
     */
    const makeTerrainScene = (iceTiles, forestTiles = []) => {
      const gameScene = new GameScene();
      gameScene.enemies = { getChildren: () => [] };
      gameScene.iceTerrains = { getChildren: () => iceTiles };
      gameScene.forestTerrains = { getChildren: () => forestTiles };
      return gameScene;
    };

    test('站在其中一塊冰上時，其他不重疊的冰塊不應該觸發離開', () => {
      const mockScene = makeMockScene();
      // 兩塊冰相距很遠
      const iceA = new Ice(mockScene, 100, 100);
      const iceB = new Ice(mockScene, 500, 500);

      const gameScene = makeTerrainScene([iceA, iceB]);
      gameScene.player = tank;
      tank.x = 100;
      tank.y = 100; // 站在 iceA 上

      // 連續多幀更新，旗標必須穩定為 true
      gameScene.updateTerrainEffects();
      gameScene.updateTerrainEffects();

      expect(tank.onIce).toBe(true);
      expect(tank.body.drag.x).toBe(TANK_CONFIG.ICE_DRAG);
    });

    test('離開所有冰塊後才應該觸發離開', () => {
      const mockScene = makeMockScene();
      const iceA = new Ice(mockScene, 100, 100);
      const iceB = new Ice(mockScene, 500, 500);

      const gameScene = makeTerrainScene([iceA, iceB]);
      gameScene.player = tank;
      tank.x = 100;
      tank.y = 100;

      gameScene.updateTerrainEffects();
      expect(tank.onIce).toBe(true);

      // 移動到完全沒有冰的位置
      tank.x = 300;
      tank.y = 300;
      gameScene.updateTerrainEffects();

      expect(tank.onIce).toBe(false);
      expect(tank.body.drag.x).toBe(TANK_CONFIG.NORMAL_DRAG);
    });

    test('森林遮蔽也應該以聚合結果判定', () => {
      const mockScene = makeMockScene();
      const forestA = new Forest(mockScene, 100, 100);
      const forestB = new Forest(mockScene, 500, 500);

      const gameScene = makeTerrainScene([], [forestA, forestB]);
      gameScene.player = tank;
      tank.x = 100;
      tank.y = 100;

      gameScene.updateTerrainEffects();
      gameScene.updateTerrainEffects();

      expect(tank.inForest).toBe(true);
      expect(tank.alpha).toBe(0.7);

      tank.x = 300;
      tank.y = 300;
      gameScene.updateTerrainEffects();

      expect(tank.inForest).toBe(false);
      expect(tank.alpha).toBe(1);
    });
  });
});
