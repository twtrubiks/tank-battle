/**
 * 玩家 grid-lock 移動測試
 * 垂直軸鎖車道中心 + 轉角緩衝（turn buffering），取代舊的轉角吸附
 */

import GameScene from '../../src/scenes/GameScene';
import GridMovement from '../../src/utils/GridMovement';
import { TANK_CONFIG } from '../../src/utils/Constants';

describe('GridMovement.axisOf', () => {
  test('up / down 屬於垂直軸', () => {
    expect(GridMovement.axisOf('up')).toBe('vertical');
    expect(GridMovement.axisOf('down')).toBe('vertical');
  });

  test('left / right 屬於水平軸', () => {
    expect(GridMovement.axisOf('left')).toBe('horizontal');
    expect(GridMovement.axisOf('right')).toBe('horizontal');
  });
});

describe('GridMovement.resolveGridDirection - 轉向決策', () => {
  const TOL = 8;

  test('無輸入回傳 null', () => {
    expect(GridMovement.resolveGridDirection('up', null, 0, true, TOL)).toBeNull();
  });

  test('沒有目前方向時直接採用輸入', () => {
    expect(GridMovement.resolveGridDirection(undefined, 'left', 0, false, TOL)).toBe('left');
  });

  test('同軸直行立即套用', () => {
    expect(GridMovement.resolveGridDirection('up', 'up', 99, true, TOL)).toBe('up');
  });

  test('同軸反向立即套用（不需緩衝）', () => {
    expect(GridMovement.resolveGridDirection('up', 'down', 99, true, TOL)).toBe('down');
  });

  test('垂直轉向且已對齊路口 → 轉', () => {
    expect(GridMovement.resolveGridDirection('up', 'left', 5, true, TOL)).toBe('left');
  });

  test('垂直轉向但尚未對齊且仍在前進 → 緩衝（維持目前方向）', () => {
    expect(GridMovement.resolveGridDirection('up', 'left', 12, true, TOL)).toBe('up');
  });

  test('垂直轉向未對齊但無法前進（怠速/撞牆）→ 直接轉，避免卡死', () => {
    expect(GridMovement.resolveGridDirection('up', 'left', 12, false, TOL)).toBe('left');
  });

  test('容差邊界：剛好等於容差視為已對齊', () => {
    expect(GridMovement.resolveGridDirection('right', 'up', 8, true, TOL)).toBe('up');
  });
});

describe('GridMovement.lockToLane - 垂直軸鎖定', () => {
  const GLIDE = 3;

  test('無方向回傳 null', () => {
    expect(GridMovement.lockToLane({ x: 100, y: 100 }, null, GLIDE)).toBeNull();
  });

  test('垂直移動鎖 x 軸，往車道中心收斂且受 glideRate 上限約束', () => {
    const center = GridMovement.gridToPixel(5, 5);
    const tank = { x: center.x + 8, y: center.y };

    const lock = GridMovement.lockToLane(tank, 'up', GLIDE);

    expect(lock.axis).toBe('x');
    expect(lock.amount).toBe(-3); // 偏移 +8、朝中心、每幀上限 3
  });

  test('水平移動鎖 y 軸', () => {
    const center = GridMovement.gridToPixel(5, 5);
    const tank = { x: center.x, y: center.y - 6 };

    const lock = GridMovement.lockToLane(tank, 'left', GLIDE);

    expect(lock.axis).toBe('y');
    expect(lock.amount).toBe(3); // 偏移 -6、朝中心 +3
  });

  test('小於 glideRate 的偏移一次精準歸位（不過衝）', () => {
    const center = GridMovement.gridToPixel(5, 5);
    const tank = { x: center.x + 2, y: center.y };

    const lock = GridMovement.lockToLane(tank, 'down', GLIDE);

    expect(lock.amount).toBe(-2);
  });

  test('已在車道中心 → 不修正（直行零側拉）', () => {
    const center = GridMovement.gridToPixel(5, 5);
    const tank = { x: center.x, y: center.y };

    const lock = GridMovement.lockToLane(tank, 'up', GLIDE);

    expect(lock.amount).toBe(0);
  });

  test('連續套用最終精準落在車道中心', () => {
    const center = GridMovement.gridToPixel(5, 5);
    const tank = { x: center.x + 10, y: center.y };

    for (let i = 0; i < 10; i++) {
      const lock = GridMovement.lockToLane(tank, 'up', GLIDE);
      tank.x += lock.amount;
    }

    expect(tank.x).toBe(center.x);
  });
});

describe('GameScene.applyPlayerGridLock - 接線整合', () => {
  let scene;

  const makePlayer = (x, y, direction, vx, vy) => ({
    x,
    y,
    direction,
    body: { velocity: { x: vx, y: vy } },
    moved: null,
    move(dir) {
      this.moved = dir;
      this.direction = dir;
    }
  });

  beforeEach(() => {
    scene = new GameScene();
  });

  test('直行：往上移動時把 x 鎖回車道中心', () => {
    const center = GridMovement.gridToPixel(5, 5);
    const startOffset = 8;
    scene.player = makePlayer(center.x + startOffset, center.y, 'up', 0, -120);

    scene.applyPlayerGridLock('up');

    expect(scene.player.moved).toBe('up');
    // +startOffset 往中心收斂，每幀上限 GRID_LANE_GLIDE
    const glide = Math.min(TANK_CONFIG.GRID_LANE_GLIDE, startOffset);
    expect(scene.player.x).toBe(center.x + startOffset - glide);
  });

  test('轉向且已對齊路口：立即轉並開始鎖另一軸', () => {
    const center = GridMovement.gridToPixel(5, 5);
    // 往上前進中、y 剛好對齊路口
    scene.player = makePlayer(center.x, center.y, 'up', 0, -120);

    scene.applyPlayerGridLock('left');

    expect(scene.player.moved).toBe('left');
  });

  test('轉向但尚未對齊且仍在前進：緩衝，先維持往上到路口', () => {
    const center = GridMovement.gridToPixel(5, 5);
    // y 偏離路口超過容差（仍 < 半格 16），且仍在往上前進 → 緩衝
    const offset = TANK_CONFIG.GRID_TURN_TOLERANCE + 1;
    scene.player = makePlayer(center.x, center.y + offset, 'up', 0, -120);

    scene.applyPlayerGridLock('left');

    expect(scene.player.moved).toBe('up');
  });

  test('撞牆（速度趨近 0）時即使未對齊也允許轉向', () => {
    const center = GridMovement.gridToPixel(5, 5);
    // y 偏離路口超過容差，但已被牆擋住（vy≈0）→ 直接轉
    const offset = TANK_CONFIG.GRID_TURN_TOLERANCE + 1;
    scene.player = makePlayer(center.x, center.y + offset, 'up', 0, 0);

    scene.applyPlayerGridLock('left');

    expect(scene.player.moved).toBe('left');
  });
});
