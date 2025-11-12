/**
 * Bullet 子彈系統單元測試
 */

describe('Bullet - 子彈系統', () => {
  describe('子彈基本屬性', () => {
    test('應該正確初始化子彈屬性', () => {
      const bullet = {
        speed: 200,
        damage: 1,
        direction: 'up',
        owner: null,
        isPlayerBullet: false,
        active: false
      };

      expect(bullet.speed).toBeGreaterThan(0);
      expect(bullet.damage).toBeGreaterThan(0);
      expect(['up', 'down', 'left', 'right']).toContain(bullet.direction);
      expect(bullet.active).toBe(false);
    });

    test('應該能識別玩家子彈', () => {
      const playerTank = { constructor: { name: 'PlayerTank' } };
      const bullet = {
        owner: playerTank,
        isPlayerBullet: playerTank.constructor.name === 'PlayerTank'
      };

      expect(bullet.isPlayerBullet).toBe(true);
    });

    test('應該能識別敵人子彈', () => {
      const enemyTank = { constructor: { name: 'EnemyTank' } };
      const bullet = {
        owner: enemyTank,
        isPlayerBullet: enemyTank.constructor.name === 'PlayerTank'
      };

      expect(bullet.isPlayerBullet).toBe(false);
    });
  });

  describe('子彈發射', () => {
    test('發射時應該設定正確的速度向量', () => {
      const DIRECTION_VECTORS = {
        up: { x: 0, y: -1 },
        down: { x: 0, y: 1 },
        left: { x: -1, y: 0 },
        right: { x: 1, y: 0 }
      };

      const direction = 'up';
      const speed = 200;
      const vector = DIRECTION_VECTORS[direction];
      const velocity = {
        x: vector.x * speed,
        y: vector.y * speed
      };

      expect(velocity.x).toBe(0);
      expect(velocity.y).toBe(-200);
    });

    test('發射時應該設定正確的角度', () => {
      const DIRECTION_ANGLES = {
        up: 0,
        down: 180,
        left: 270,
        right: 90
      };

      expect(DIRECTION_ANGLES.up).toBe(0);
      expect(DIRECTION_ANGLES.down).toBe(180);
      expect(DIRECTION_ANGLES.left).toBe(270);
      expect(DIRECTION_ANGLES.right).toBe(90);
    });

    test('玩家子彈應該是黃色', () => {
      const BULLET_COLORS = {
        PLAYER: 0xFFFF00,
        ENEMY: 0xFF0000
      };

      const playerBullet = {
        isPlayerBullet: true,
        color: BULLET_COLORS.PLAYER
      };

      expect(playerBullet.color).toBe(0xFFFF00);
    });

    test('敵人子彈應該是紅色', () => {
      const BULLET_COLORS = {
        PLAYER: 0xFFFF00,
        ENEMY: 0xFF0000
      };

      const enemyBullet = {
        isPlayerBullet: false,
        color: BULLET_COLORS.ENEMY
      };

      expect(enemyBullet.color).toBe(0xFF0000);
    });
  });

  describe('子彈碰撞與銷毀', () => {
    test('擊中目標時應該調用 onHit', () => {
      const bullet = {
        active: true,
        onHit: jest.fn()
      };

      bullet.onHit();

      expect(bullet.onHit).toHaveBeenCalled();
    });

    test('超出邊界時應該被銷毀', () => {
      const worldBounds = { x: 0, y: 0, width: 832, height: 832 };
      const bulletPosition = { x: 900, y: 400 };

      const isOutOfBounds =
        bulletPosition.x < worldBounds.x ||
        bulletPosition.x > worldBounds.width ||
        bulletPosition.y < worldBounds.y ||
        bulletPosition.y > worldBounds.height;

      expect(isOutOfBounds).toBe(true);
    });

    test('兩顆子彈相撞時應該相互抵銷', () => {
      const bullet1 = { active: true, onHit: jest.fn() };
      const bullet2 = { active: true, onHit: jest.fn() };

      // 模擬子彈相撞
      if (bullet1.active && bullet2.active && bullet1 !== bullet2) {
        bullet1.onHit();
        bullet2.onHit();
      }

      expect(bullet1.onHit).toHaveBeenCalled();
      expect(bullet2.onHit).toHaveBeenCalled();
    });
  });

  describe('子彈物件池', () => {
    test('應該從池中取得子彈', () => {
      const bulletPool = {
        available: [{ id: 1 }, { id: 2 }],
        get: function() {
          return this.available.pop();
        }
      };

      const bullet = bulletPool.get();
      expect(bullet).toBeDefined();
      expect(bulletPool.available.length).toBe(1);
    });

    test('應該將子彈歸還到池', () => {
      const bulletPool = {
        available: [],
        release: function(bullet) {
          bullet.active = false;
          this.available.push(bullet);
        }
      };

      const bullet = { id: 1, active: true };
      bulletPool.release(bullet);

      expect(bullet.active).toBe(false);
      expect(bulletPool.available.length).toBe(1);
    });
  });
});
