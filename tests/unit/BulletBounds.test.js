/**
 * 子彈邊界與回收測試（真實實作）
 */

import Bullet from '../../src/entities/Bullet';

const makeMockScene = () => ({
  add: { existing: jest.fn() },
  physics: {
    world: {
      bounds: {
        contains: jest.fn(() => true)
      }
    }
  },
  createHitEffect: jest.fn(),
  audioManager: null
});

describe('Bullet', () => {
  let scene;
  let bullet;

  beforeEach(() => {
    scene = makeMockScene();
    bullet = new Bullet(scene, 100, 100);
  });

  describe('fire - 發射', () => {
    test('應該依 owner 陣營設定 isPlayerBullet', () => {
      bullet.fire(100, 100, 'up', 200, 1, { faction: 'player' });
      expect(bullet.isPlayerBullet).toBe(true);

      bullet.fire(100, 100, 'up', 200, 1, { faction: 'enemy' });
      expect(bullet.isPlayerBullet).toBe(false);
    });

    test('應該設定速度向量', () => {
      bullet.fire(100, 100, 'right', 200, 1, { faction: 'enemy' });

      expect(bullet.body.velocity.x).toBe(200);
      expect(bullet.body.velocity.y).toBe(0);
    });
  });

  describe('preUpdate - 出界處理', () => {
    test('出界時應該觸發爆炸回饋（onHit）而非無聲消失', () => {
      bullet.fire(100, 100, 'up', 200, 1, { faction: 'enemy' });
      scene.physics.world.bounds.contains.mockReturnValue(false);

      bullet.preUpdate(0, 16);

      // 有擊中特效，且子彈停用回收
      expect(scene.createHitEffect).toHaveBeenCalled();
      expect(bullet.active).toBe(false);
    });

    test('界內飛行時不應該停用', () => {
      bullet.fire(100, 100, 'up', 200, 1, { faction: 'enemy' });
      scene.physics.world.bounds.contains.mockReturnValue(true);

      bullet.preUpdate(0, 16);

      expect(bullet.active).toBe(true);
    });
  });

  describe('deactivate - 回收', () => {
    test('應該停止移動並清除 owner', () => {
      bullet.fire(100, 100, 'down', 200, 1, { faction: 'enemy' });
      bullet.deactivate();

      expect(bullet.active).toBe(false);
      expect(bullet.visible).toBe(false);
      expect(bullet.body.velocity.x).toBe(0);
      expect(bullet.body.velocity.y).toBe(0);
      expect(bullet.owner).toBeNull();
    });
  });
});
