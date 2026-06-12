/**
 * PlayerTank 單元測試
 * 直接以真實實作測試玩家坦克的受傷 / 死亡流程
 */

import PlayerTank from '../../src/entities/PlayerTank';

describe('PlayerTank', () => {
  let mockScene;
  let player;

  beforeEach(() => {
    mockScene = {
      add: { existing: jest.fn(), circle: jest.fn() },
      physics: { add: { existing: jest.fn() } },
      time: { now: 1000, delayedCall: jest.fn() },
      tweens: { add: jest.fn() },
      events: { emit: jest.fn() },
      respawnPlayer: jest.fn(),
      gameOver: jest.fn(),
      createExplosion: jest.fn(),
      bullets: { getChildren: () => [] }
    };

    player = new PlayerTank(mockScene, 100, 100);
    // 出生無敵由 tween 控制，測試中直接解除
    player.isInvincible = false;
  });

  describe('基本屬性', () => {
    test('陣營應該是 player', () => {
      expect(player.faction).toBe('player');
    });

    test('初始生命數為 3', () => {
      expect(player.lives).toBe(3);
    });
  });

  describe('takeDamage - 受傷處理', () => {
    test('受到致命傷害時應該扣一條命並重生', () => {
      player.takeDamage(1);

      expect(player.lives).toBe(2);
      expect(mockScene.respawnPlayer).toHaveBeenCalledTimes(1);
      expect(player.isDestroyed).toBe(true);
    });

    test('同幀第二次傷害不應該重複觸發死亡（重複死亡防護）', () => {
      // 模擬同一個物理步進中兩顆敵彈先後命中
      player.takeDamage(1);
      player.takeDamage(1);

      // 生命只能扣一次、重生只能觸發一次
      expect(player.lives).toBe(2);
      expect(mockScene.respawnPlayer).toHaveBeenCalledTimes(1);
    });

    test('無敵狀態下不應該受傷', () => {
      player.isInvincible = true;
      player.takeDamage(1);

      expect(player.health).toBe(1);
      expect(player.lives).toBe(3);
    });

    test('護盾狀態下不應該受傷', () => {
      player.powerUps.shield = true;
      player.takeDamage(1);

      expect(player.health).toBe(1);
      expect(player.lives).toBe(3);
    });

    test('最後一條命死亡時應該觸發遊戲結束而非重生', () => {
      player.lives = 1;
      player.takeDamage(1);

      expect(player.lives).toBe(0);
      expect(mockScene.respawnPlayer).not.toHaveBeenCalled();
      expect(mockScene.gameOver).toHaveBeenCalledTimes(1);
    });
  });
});
