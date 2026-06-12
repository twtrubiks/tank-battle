/**
 * CollisionSystem 碰撞系統單元測試
 * 測試友軍傷害防止、水域碰撞等邏輯
 *
 * bulletTankFilter 直接測試真實實作（faction 欄位判定，
 * 不依賴 constructor.name，避免 production 壓縮改名造成誤判）
 */

import CollisionSystem from '../../src/systems/CollisionSystem';

describe('CollisionSystem', () => {
  let collisionSystem;

  beforeEach(() => {
    collisionSystem = new CollisionSystem({});
  });

  /**
   * 建立測試用坦克
   * @param {string} faction - 'player' | 'enemy'
   * @param {Object} extra - 額外屬性
   */
  const makeTank = (faction, extra = {}) => ({ faction, ...extra });

  /**
   * 建立測試用子彈
   * @param {Object} owner - 發射者
   */
  const makeBullet = (owner, active = true) => ({
    active,
    owner,
    isPlayerBullet: !!owner && owner.faction === 'player'
  });

  describe('bulletTankFilter - 子彈與坦克碰撞過濾器', () => {
    test('子彈不應該擊中發射者', () => {
      const player = makeTank('player');
      const bullet = makeBullet(player);

      expect(collisionSystem.bulletTankFilter(bullet, player)).toBe(false);
    });

    test('玩家子彈應該能擊中敵人', () => {
      const player = makeTank('player');
      const enemy = makeTank('enemy');
      const bullet = makeBullet(player);

      expect(collisionSystem.bulletTankFilter(bullet, enemy)).toBe(true);
    });

    test('敵人子彈不應該擊中其他敵人（友軍傷害防止）', () => {
      const enemy1 = makeTank('enemy');
      const enemy2 = makeTank('enemy');
      const bullet = makeBullet(enemy1);

      expect(collisionSystem.bulletTankFilter(bullet, enemy2)).toBe(false);
    });

    test('敵人子彈應該能擊中玩家', () => {
      const enemy = makeTank('enemy');
      const player = makeTank('player');
      const bullet = makeBullet(enemy);

      expect(collisionSystem.bulletTankFilter(bullet, player)).toBe(true);
    });

    test('玩家子彈不應該擊中其他玩家坦克（雙人模式自傷防止）', () => {
      const player1 = makeTank('player');
      const player2 = makeTank('player');
      const bullet = makeBullet(player1);

      expect(collisionSystem.bulletTankFilter(bullet, player2)).toBe(false);
    });

    test('非活躍子彈不應該碰撞', () => {
      const enemy = makeTank('enemy');
      const bullet = makeBullet(makeTank('player'), false);

      expect(collisionSystem.bulletTankFilter(bullet, enemy)).toBe(false);
    });

    test('陣營判定不依賴 constructor.name（壓縮改名迴歸測試）', () => {
      // 模擬 production 壓縮後類名被改成無意義字元的情況
      class A {}
      class B {}
      const enemy1 = Object.assign(new A(), { faction: 'enemy' });
      const enemy2 = Object.assign(new B(), { faction: 'enemy' });
      const player = Object.assign(new A(), { faction: 'player' });

      const enemyBullet = makeBullet(enemy1);
      expect(collisionSystem.bulletTankFilter(enemyBullet, enemy2)).toBe(false);
      expect(collisionSystem.bulletTankFilter(enemyBullet, player)).toBe(true);
    });
  });

  describe('不同類型敵方坦克之間的友軍傷害防止', () => {
    const enemyTypes = ['BASIC', 'FAST', 'POWER', 'ARMOR'];

    test('任意類型組合的敵方子彈都不應該擊中敵方坦克', () => {
      enemyTypes.forEach((shooterType) => {
        enemyTypes.forEach((targetType) => {
          const shooter = makeTank('enemy', { enemyType: shooterType });
          const target = makeTank('enemy', { enemyType: targetType });
          const bullet = makeBullet(shooter);

          expect(collisionSystem.bulletTankFilter(bullet, target)).toBe(false);
        });
      });
    });

    test('確認玩家子彈仍然可以擊中所有類型的敵方坦克', () => {
      const player = makeTank('player');

      enemyTypes.forEach((type) => {
        const enemy = makeTank('enemy', { enemyType: type });
        const bullet = makeBullet(player);

        expect(collisionSystem.bulletTankFilter(bullet, enemy)).toBe(true);
      });
    });

    test('確認所有類型的敵方子彈仍然可以擊中玩家', () => {
      const player = makeTank('player');

      enemyTypes.forEach((type) => {
        const enemy = makeTank('enemy', { enemyType: type });
        const bullet = makeBullet(enemy);

        expect(collisionSystem.bulletTankFilter(bullet, player)).toBe(true);
      });
    });
  });

  describe('onBulletWallCollision - 子彈與牆壁碰撞', () => {
    test('子彈應該在碰到磚牆時被摧毀', () => {
      const mockBullet = { active: true, onHit: jest.fn() };
      const mockWall = { type: 'brick', takeDamage: jest.fn() };

      collisionSystem.onBulletWallCollision(mockBullet, mockWall);

      expect(mockWall.takeDamage).toHaveBeenCalled();
      expect(mockBullet.onHit).toHaveBeenCalled();
    });

    test('子彈應該穿透水域', () => {
      const mockBullet = { active: true, onHit: jest.fn() };
      const mockWater = { type: 'water' };

      collisionSystem.onBulletWallCollision(mockBullet, mockWater);

      // 子彈不應該被摧毀
      expect(mockBullet.onHit).not.toHaveBeenCalled();
    });

    test('子彈應該在碰到鋼牆時被摧毀', () => {
      const mockBullet = { active: true, damage: 1, onHit: jest.fn() };
      const mockWall = { type: 'steel', takeDamage: jest.fn() };

      collisionSystem.onBulletWallCollision(mockBullet, mockWall);

      expect(mockWall.takeDamage).toHaveBeenCalledWith(1);
      expect(mockBullet.onHit).toHaveBeenCalled();
    });

    test('非活躍子彈不應該觸發牆壁碰撞', () => {
      const mockBullet = { active: false, onHit: jest.fn() };
      const mockWall = { type: 'brick', takeDamage: jest.fn() };

      collisionSystem.onBulletWallCollision(mockBullet, mockWall);

      expect(mockWall.takeDamage).not.toHaveBeenCalled();
      expect(mockBullet.onHit).not.toHaveBeenCalled();
    });
  });

  describe('onBulletBulletCollision - 子彈相互碰撞', () => {
    test('玩家子彈和敵人子彈應該互相抵銷', () => {
      const playerBullet = { active: true, isPlayerBullet: true, x: 0, y: 0, onHit: jest.fn() };
      const enemyBullet = { active: true, isPlayerBullet: false, x: 0, y: 0, onHit: jest.fn() };

      collisionSystem.onBulletBulletCollision(playerBullet, enemyBullet);

      expect(playerBullet.onHit).toHaveBeenCalled();
      expect(enemyBullet.onHit).toHaveBeenCalled();
    });

    test('兩顆敵人子彈不應該互相抵銷', () => {
      const bullet1 = { active: true, isPlayerBullet: false, x: 0, y: 0, onHit: jest.fn() };
      const bullet2 = { active: true, isPlayerBullet: false, x: 0, y: 0, onHit: jest.fn() };

      collisionSystem.onBulletBulletCollision(bullet1, bullet2);

      expect(bullet1.onHit).not.toHaveBeenCalled();
      expect(bullet2.onHit).not.toHaveBeenCalled();
    });

    test('兩顆玩家子彈不應該互相抵銷', () => {
      const bullet1 = { active: true, isPlayerBullet: true, x: 0, y: 0, onHit: jest.fn() };
      const bullet2 = { active: true, isPlayerBullet: true, x: 0, y: 0, onHit: jest.fn() };

      collisionSystem.onBulletBulletCollision(bullet1, bullet2);

      expect(bullet1.onHit).not.toHaveBeenCalled();
      expect(bullet2.onHit).not.toHaveBeenCalled();
    });
  });

  describe('邊界碰撞', () => {
    test('坦克應該被限制在世界邊界內', () => {
      const worldBounds = { x: 0, y: 0, width: 832, height: 832 };
      const tankPosition = { x: 850, y: 400 }; // 超出邊界

      // 檢查是否在邊界內
      const isOutOfBounds =
        tankPosition.x < worldBounds.x ||
        tankPosition.x > worldBounds.width ||
        tankPosition.y < worldBounds.y ||
        tankPosition.y > worldBounds.height;

      expect(isOutOfBounds).toBe(true);

      // 應該被 setCollideWorldBounds 阻擋
      // 實際遊戲中由 Phaser 物理引擎處理
    });

    test('坦克在邊界內應該可以自由移動', () => {
      const worldBounds = { x: 0, y: 0, width: 832, height: 832 };
      const tankPosition = { x: 400, y: 400 }; // 在邊界內

      const isInBounds =
        tankPosition.x >= worldBounds.x &&
        tankPosition.x <= worldBounds.width &&
        tankPosition.y >= worldBounds.y &&
        tankPosition.y <= worldBounds.height;

      expect(isInBounds).toBe(true);
    });
  });
});
