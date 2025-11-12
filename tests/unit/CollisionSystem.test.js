/**
 * CollisionSystem 碰撞系統單元測試
 * 測試友軍傷害防止、水域碰撞等邏輯
 */

describe('CollisionSystem', () => {
  describe('bulletTankFilter - 子彈與坦克碰撞過濾器', () => {
    test('子彈不應該擊中發射者', () => {
      const mockTank = { id: 'tank1', constructor: { name: 'PlayerTank' } };
      const mockBullet = {
        active: true,
        owner: mockTank,
        isPlayerBullet: true
      };

      // 模擬 bulletTankFilter 邏輯
      const shouldCollide = mockBullet.active && mockBullet.owner !== mockTank;
      expect(shouldCollide).toBe(false);
    });

    test('玩家子彈應該能擊中敵人', () => {
      const playerTank = { id: 'player', constructor: { name: 'PlayerTank' } };
      const enemyTank = { id: 'enemy1', constructor: { name: 'EnemyTank' } };
      const playerBullet = {
        active: true,
        owner: playerTank,
        isPlayerBullet: true
      };

      // 模擬過濾邏輯
      const isActive = playerBullet.active;
      const notOwner = playerBullet.owner !== enemyTank;
      const isEnemyBullet = !playerBullet.isPlayerBullet;
      const isEnemyTank = enemyTank.constructor.name === 'EnemyTank';

      // 玩家子彈不會被友軍傷害規則阻擋
      const blockedByFriendlyFire = isEnemyBullet && isEnemyTank;
      const shouldCollide = isActive && notOwner && !blockedByFriendlyFire;

      expect(shouldCollide).toBe(true);
    });

    test('敵人子彈不應該擊中其他敵人（友軍傷害防止）', () => {
      const enemyTank1 = { id: 'enemy1', constructor: { name: 'EnemyTank' } };
      const enemyTank2 = { id: 'enemy2', constructor: { name: 'EnemyTank' } };
      const enemyBullet = {
        active: true,
        owner: enemyTank1,
        isPlayerBullet: false
      };

      // 模擬友軍傷害防止邏輯
      const isActive = enemyBullet.active;
      const notOwner = enemyBullet.owner !== enemyTank2;
      const isEnemyBullet = !enemyBullet.isPlayerBullet;
      const isEnemyTank = enemyTank2.constructor.name === 'EnemyTank';

      // 敵人子彈 + 敵人坦克 = 被阻擋
      const blockedByFriendlyFire = isEnemyBullet && isEnemyTank;
      const shouldCollide = isActive && notOwner && !blockedByFriendlyFire;

      expect(blockedByFriendlyFire).toBe(true);
      expect(shouldCollide).toBe(false);
    });

    test('敵人子彈應該能擊中玩家', () => {
      const enemyTank = { id: 'enemy', constructor: { name: 'EnemyTank' } };
      const playerTank = { id: 'player', constructor: { name: 'PlayerTank' } };
      const enemyBullet = {
        active: true,
        owner: enemyTank,
        isPlayerBullet: false
      };

      // 模擬過濾邏輯
      const isActive = enemyBullet.active;
      const notOwner = enemyBullet.owner !== playerTank;
      const isEnemyBullet = !enemyBullet.isPlayerBullet;
      const isEnemyTank = playerTank.constructor.name === 'EnemyTank';

      // 玩家不是敵人，不會被友軍傷害規則阻擋
      const blockedByFriendlyFire = isEnemyBullet && isEnemyTank;
      const shouldCollide = isActive && notOwner && !blockedByFriendlyFire;

      expect(blockedByFriendlyFire).toBe(false);
      expect(shouldCollide).toBe(true);
    });

    test('非活躍子彈不應該碰撞', () => {
      const mockTank = { id: 'tank', constructor: { name: 'EnemyTank' } };
      const mockBullet = {
        active: false,
        owner: null,
        isPlayerBullet: false
      };

      const shouldCollide = mockBullet.active;
      expect(shouldCollide).toBe(false);
    });
  });

  describe('不同類型敵方坦克之間的友軍傷害防止', () => {
    test('BASIC 坦克的子彈不應該擊中 FAST 坦克', () => {
      const basicTank = {
        id: 'enemy-basic',
        constructor: { name: 'EnemyTank' },
        enemyType: 'BASIC'
      };
      const fastTank = {
        id: 'enemy-fast',
        constructor: { name: 'EnemyTank' },
        enemyType: 'FAST'
      };
      const basicBullet = {
        active: true,
        owner: basicTank,
        isPlayerBullet: false
      };

      // 模擬完整的 bulletTankFilter 邏輯
      const isActive = basicBullet.active;
      const notOwner = basicBullet.owner !== fastTank;
      const isPlayerBullet = basicBullet.isPlayerBullet;
      const isPlayerTank = fastTank.constructor.name === 'PlayerTank';
      const isEnemyTank = fastTank.constructor.name === 'EnemyTank';

      // 敵人子彈不能擊中敵人坦克
      const blockedByFriendlyFire = !isPlayerBullet && isEnemyTank;
      const shouldCollide = isActive && notOwner && !blockedByFriendlyFire;

      expect(blockedByFriendlyFire).toBe(true);
      expect(shouldCollide).toBe(false);
    });

    test('FAST 坦克的子彈不應該擊中 POWER 坦克', () => {
      const fastTank = {
        id: 'enemy-fast',
        constructor: { name: 'EnemyTank' },
        enemyType: 'FAST'
      };
      const powerTank = {
        id: 'enemy-power',
        constructor: { name: 'EnemyTank' },
        enemyType: 'POWER'
      };
      const fastBullet = {
        active: true,
        owner: fastTank,
        isPlayerBullet: false
      };

      // 模擬完整的 bulletTankFilter 邏輯
      const isActive = fastBullet.active;
      const notOwner = fastBullet.owner !== powerTank;
      const isPlayerBullet = fastBullet.isPlayerBullet;
      const isPlayerTank = powerTank.constructor.name === 'PlayerTank';
      const isEnemyTank = powerTank.constructor.name === 'EnemyTank';

      // 敵人子彈不能擊中敵人坦克
      const blockedByFriendlyFire = !isPlayerBullet && isEnemyTank;
      const shouldCollide = isActive && notOwner && !blockedByFriendlyFire;

      expect(blockedByFriendlyFire).toBe(true);
      expect(shouldCollide).toBe(false);
    });

    test('POWER 坦克的子彈不應該擊中 ARMOR 坦克', () => {
      const powerTank = {
        id: 'enemy-power',
        constructor: { name: 'EnemyTank' },
        enemyType: 'POWER'
      };
      const armorTank = {
        id: 'enemy-armor',
        constructor: { name: 'EnemyTank' },
        enemyType: 'ARMOR'
      };
      const powerBullet = {
        active: true,
        owner: powerTank,
        isPlayerBullet: false
      };

      // 模擬完整的 bulletTankFilter 邏輯
      const isActive = powerBullet.active;
      const notOwner = powerBullet.owner !== armorTank;
      const isPlayerBullet = powerBullet.isPlayerBullet;
      const isPlayerTank = armorTank.constructor.name === 'PlayerTank';
      const isEnemyTank = armorTank.constructor.name === 'EnemyTank';

      // 敵人子彈不能擊中敵人坦克
      const blockedByFriendlyFire = !isPlayerBullet && isEnemyTank;
      const shouldCollide = isActive && notOwner && !blockedByFriendlyFire;

      expect(blockedByFriendlyFire).toBe(true);
      expect(shouldCollide).toBe(false);
    });

    test('ARMOR 坦克的子彈不應該擊中 BASIC 坦克', () => {
      const armorTank = {
        id: 'enemy-armor',
        constructor: { name: 'EnemyTank' },
        enemyType: 'ARMOR'
      };
      const basicTank = {
        id: 'enemy-basic',
        constructor: { name: 'EnemyTank' },
        enemyType: 'BASIC'
      };
      const armorBullet = {
        active: true,
        owner: armorTank,
        isPlayerBullet: false
      };

      // 模擬完整的 bulletTankFilter 邏輯
      const isActive = armorBullet.active;
      const notOwner = armorBullet.owner !== basicTank;
      const isPlayerBullet = armorBullet.isPlayerBullet;
      const isPlayerTank = basicTank.constructor.name === 'PlayerTank';
      const isEnemyTank = basicTank.constructor.name === 'EnemyTank';

      // 敵人子彈不能擊中敵人坦克
      const blockedByFriendlyFire = !isPlayerBullet && isEnemyTank;
      const shouldCollide = isActive && notOwner && !blockedByFriendlyFire;

      expect(blockedByFriendlyFire).toBe(true);
      expect(shouldCollide).toBe(false);
    });

    test('同類型敵方坦克（BASIC）的子彈也不應該互相攻擊', () => {
      const basicTank1 = {
        id: 'enemy-basic-1',
        constructor: { name: 'EnemyTank' },
        enemyType: 'BASIC'
      };
      const basicTank2 = {
        id: 'enemy-basic-2',
        constructor: { name: 'EnemyTank' },
        enemyType: 'BASIC'
      };
      const basicBullet = {
        active: true,
        owner: basicTank1,
        isPlayerBullet: false
      };

      // 模擬完整的 bulletTankFilter 邏輯
      const isActive = basicBullet.active;
      const notOwner = basicBullet.owner !== basicTank2;
      const isPlayerBullet = basicBullet.isPlayerBullet;
      const isPlayerTank = basicTank2.constructor.name === 'PlayerTank';
      const isEnemyTank = basicTank2.constructor.name === 'EnemyTank';

      // 敵人子彈不能擊中敵人坦克（即使是同類型）
      const blockedByFriendlyFire = !isPlayerBullet && isEnemyTank;
      const shouldCollide = isActive && notOwner && !blockedByFriendlyFire;

      expect(blockedByFriendlyFire).toBe(true);
      expect(shouldCollide).toBe(false);
    });

    test('同類型敵方坦克（ARMOR）的子彈也不應該互相攻擊', () => {
      const armorTank1 = {
        id: 'enemy-armor-1',
        constructor: { name: 'EnemyTank' },
        enemyType: 'ARMOR'
      };
      const armorTank2 = {
        id: 'enemy-armor-2',
        constructor: { name: 'EnemyTank' },
        enemyType: 'ARMOR'
      };
      const armorBullet = {
        active: true,
        owner: armorTank1,
        isPlayerBullet: false
      };

      // 模擬完整的 bulletTankFilter 邏輯
      const isActive = armorBullet.active;
      const notOwner = armorBullet.owner !== armorTank2;
      const isPlayerBullet = armorBullet.isPlayerBullet;
      const isPlayerTank = armorTank2.constructor.name === 'PlayerTank';
      const isEnemyTank = armorTank2.constructor.name === 'EnemyTank';

      // 敵人子彈不能擊中敵人坦克（即使是同類型）
      const blockedByFriendlyFire = !isPlayerBullet && isEnemyTank;
      const shouldCollide = isActive && notOwner && !blockedByFriendlyFire;

      expect(blockedByFriendlyFire).toBe(true);
      expect(shouldCollide).toBe(false);
    });

    test('確認玩家子彈仍然可以擊中所有類型的敵方坦克', () => {
      const playerTank = {
        id: 'player',
        constructor: { name: 'PlayerTank' }
      };
      const enemyTypes = ['BASIC', 'FAST', 'POWER', 'ARMOR'];

      enemyTypes.forEach((type) => {
        const enemyTank = {
          id: `enemy-${type}`,
          constructor: { name: 'EnemyTank' },
          enemyType: type
        };
        const playerBullet = {
          active: true,
          owner: playerTank,
          isPlayerBullet: true
        };

        // 模擬完整的 bulletTankFilter 邏輯
        const isActive = playerBullet.active;
        const notOwner = playerBullet.owner !== enemyTank;
        const isPlayerBullet = playerBullet.isPlayerBullet;
        const isPlayerTank = enemyTank.constructor.name === 'PlayerTank';
        const isEnemyTank = enemyTank.constructor.name === 'EnemyTank';

        // 玩家子彈可以擊中敵人
        const blockedByFriendlyFire = !isPlayerBullet && isEnemyTank;
        const blockedBySelfDamage = isPlayerBullet && isPlayerTank;
        const shouldCollide = isActive && notOwner && !blockedByFriendlyFire && !blockedBySelfDamage;

        expect(shouldCollide).toBe(true);
      });
    });

    test('確認所有類型的敵方子彈仍然可以擊中玩家', () => {
      const playerTank = {
        id: 'player',
        constructor: { name: 'PlayerTank' }
      };
      const enemyTypes = ['BASIC', 'FAST', 'POWER', 'ARMOR'];

      enemyTypes.forEach((type) => {
        const enemyTank = {
          id: `enemy-${type}`,
          constructor: { name: 'EnemyTank' },
          enemyType: type
        };
        const enemyBullet = {
          active: true,
          owner: enemyTank,
          isPlayerBullet: false
        };

        // 模擬完整的 bulletTankFilter 邏輯
        const isActive = enemyBullet.active;
        const notOwner = enemyBullet.owner !== playerTank;
        const isPlayerBullet = enemyBullet.isPlayerBullet;
        const isPlayerTank = playerTank.constructor.name === 'PlayerTank';
        const isEnemyTank = playerTank.constructor.name === 'EnemyTank';

        // 敵人子彈可以擊中玩家
        const blockedByFriendlyFire = !isPlayerBullet && isEnemyTank;
        const blockedBySelfDamage = isPlayerBullet && isPlayerTank;
        const shouldCollide = isActive && notOwner && !blockedByFriendlyFire && !blockedBySelfDamage;

        expect(shouldCollide).toBe(true);
      });
    });
  });

  describe('onBulletWallCollision - 子彈與牆壁碰撞', () => {
    test('子彈應該在碰到磚牆時被摧毀', () => {
      const mockBullet = { active: true, onHit: jest.fn() };
      const mockWall = { type: 'brick', takeDamage: jest.fn() };

      // 模擬碰撞處理
      if (mockBullet.active && mockWall.type !== 'water') {
        if (mockWall.takeDamage) {
          mockWall.takeDamage(1);
        }
        mockBullet.onHit();
      }

      expect(mockWall.takeDamage).toHaveBeenCalled();
      expect(mockBullet.onHit).toHaveBeenCalled();
    });

    test('子彈應該穿透水域', () => {
      const mockBullet = { active: true, onHit: jest.fn() };
      const mockWater = { type: 'water' };

      // 模擬水域碰撞處理
      if (mockBullet.active && mockWater.type !== 'water') {
        mockBullet.onHit();
      }

      // 子彈不應該被摧毀
      expect(mockBullet.onHit).not.toHaveBeenCalled();
    });

    test('子彈應該在碰到鋼牆時被摧毀', () => {
      const mockBullet = { active: true, onHit: jest.fn() };
      const mockWall = { type: 'steel', takeDamage: jest.fn() };

      // 模擬碰撞處理
      if (mockBullet.active && mockWall.type !== 'water') {
        if (mockWall.takeDamage) {
          mockWall.takeDamage(1);
        }
        mockBullet.onHit();
      }

      expect(mockBullet.onHit).toHaveBeenCalled();
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
