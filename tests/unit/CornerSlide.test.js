/**
 * 轉角滑動輔助測試
 * 移動時將坦克往通道中心線微調，避免數 px 偏移卡在牆角
 */

import GameScene from '../../src/scenes/GameScene';
import GridMovement from '../../src/utils/GridMovement';
import { TILE_TYPES } from '../../src/utils/Constants';

const makeEmptyMap = (size = 26) =>
  Array(size).fill(null).map(() => Array(size).fill(TILE_TYPES.EMPTY));

describe('GameScene.applyCornerSlide - 轉角滑動輔助', () => {
  let scene;

  beforeEach(() => {
    scene = new GameScene();
    scene.levelData = { map: makeEmptyMap() };
  });

  test('垂直移動且偏離中心線時應該往中心修正', () => {
    const center = GridMovement.gridToPixel(5, 5);
    const tank = { x: center.x + 8, y: center.y };

    scene.applyCornerSlide(tank, 'up');

    // 每幀最多修正 3px，方向朝中心
    expect(tank.x).toBe(center.x + 5);
  });

  test('水平移動且偏離中心線時應該往中心修正', () => {
    const center = GridMovement.gridToPixel(5, 5);
    const tank = { x: center.x, y: center.y - 6 };

    scene.applyCornerSlide(tank, 'left');

    expect(tank.y).toBe(center.y - 3);
  });

  test('連續修正最終應該對齊到中心線', () => {
    const center = GridMovement.gridToPixel(5, 5);
    const tank = { x: center.x + 8, y: center.y };

    // 模擬連續多幀移動
    for (let i = 0; i < 10; i++) {
      scene.applyCornerSlide(tank, 'up');
    }

    // 收斂到 2px 死區內
    expect(Math.abs(tank.x - center.x)).toBeLessThanOrEqual(2);
  });

  test('已在中心線上時不應該修正', () => {
    const center = GridMovement.gridToPixel(5, 5);
    const tank = { x: center.x, y: center.y };

    scene.applyCornerSlide(tank, 'up');

    expect(tank.x).toBe(center.x);
    expect(tank.y).toBe(center.y);
  });

  test('修正目標被牆阻擋時不應該移動', () => {
    const map = makeEmptyMap();
    map[5][5] = TILE_TYPES.BRICK;
    scene.levelData = { map };

    const center = GridMovement.gridToPixel(5, 5);
    const tank = { x: center.x + 8, y: center.y };

    scene.applyCornerSlide(tank, 'up');

    expect(tank.x).toBe(center.x + 8);
  });

  test('沒有地圖資料時不應該造成錯誤', () => {
    scene.levelData = null;
    const tank = { x: 100, y: 100 };

    expect(() => scene.applyCornerSlide(tank, 'up')).not.toThrow();
  });
});
