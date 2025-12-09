/**
 * 碰撞系統
 * 管理遊戲中所有碰撞檢測與處理
 */

export default class CollisionSystem {
  /**
   * 建構子
   * @param {Phaser.Scene} scene - 場景實例
   */
  constructor(scene) {
    this.scene = scene;

    // 碰撞群組
    this.playerGroup = null;
    this.enemyGroup = null;
    this.bulletGroup = null;
    this.wallGroup = null;
    this.powerUpGroup = null;
    this.baseGroup = null;
  }

  /**
   * 初始化碰撞群組
   */
  init() {
    // 建立物理群組
    this.playerGroup = this.scene.physics.add.group();
    this.enemyGroup = this.scene.physics.add.group();
    this.bulletGroup = this.scene.physics.add.group();
    this.wallGroup = this.scene.physics.add.staticGroup();  // 靜態群組，會為實體創建靜態 body
    this.powerUpGroup = this.scene.physics.add.group();
    this.baseGroup = this.scene.physics.add.staticGroup();  // 靜態群組，會為實體創建靜態 body

    // 設定碰撞規則
    this.setupCollisions();
  }

  /**
   * 設定所有碰撞規則
   */
  setupCollisions() {
    // ===== 坦克相關碰撞 =====

    // 1. 玩家坦克與牆壁
    this.scene.physics.add.collider(
      this.playerGroup,
      this.wallGroup,
      this.onTankWallCollision,
      null,
      this
    );

    // 2. 敵人坦克與牆壁
    this.scene.physics.add.collider(
      this.enemyGroup,
      this.wallGroup,
      this.onTankWallCollision,
      null,
      this
    );

    // 3. 玩家坦克與敵人坦克
    this.scene.physics.add.collider(
      this.playerGroup,
      this.enemyGroup,
      this.onTankTankCollision,
      null,
      this
    );

    // 3.5 玩家坦克與基地（防止穿越）
    this.scene.physics.add.collider(
      this.playerGroup,
      this.baseGroup
    );

    // 3.6 敵人坦克與基地（防止穿越，並觸發換向）
    this.scene.physics.add.collider(
      this.enemyGroup,
      this.baseGroup,
      this.onTankWallCollision,  // 使用與牆壁相同的處理
      null,
      this
    );

    // 4. 敵人坦克之間
    // 注意：經典 FC 坦克大戰中，敵人坦克可以互相穿過，不會碰撞
    // 這是為了避免敵人 AI 互相阻擋，並增加遊戲難度（多敵人疊加進攻）
    // 因此不設置敵人之間的碰撞

    // ===== 子彈相關碰撞 =====

    // 5. 子彈與牆壁
    this.scene.physics.add.overlap(
      this.bulletGroup,
      this.wallGroup,
      this.onBulletWallCollision,
      null,
      this
    );

    // 6. 子彈與玩家坦克
    this.scene.physics.add.overlap(
      this.bulletGroup,
      this.playerGroup,
      this.onBulletTankCollision,
      this.bulletTankFilter,
      this
    );

    // 7. 子彈與敵人坦克
    this.scene.physics.add.overlap(
      this.bulletGroup,
      this.enemyGroup,
      this.onBulletTankCollision,
      this.bulletTankFilter,
      this
    );

    // 8. 子彈相互碰撞
    this.scene.physics.add.overlap(
      this.bulletGroup,
      this.bulletGroup,
      this.onBulletBulletCollision,
      null,
      this
    );

    // 9. 子彈與基地
    this.scene.physics.add.overlap(
      this.bulletGroup,
      this.baseGroup,
      this.onBulletBaseCollision,
      null,
      this
    );

    // ===== 道具相關碰撞 =====

    // 10. 玩家坦克與道具
    this.scene.physics.add.overlap(
      this.playerGroup,
      this.powerUpGroup,
      this.onPlayerPowerUpCollision,
      null,
      this
    );
  }

  // ========== 碰撞處理方法 ==========

  /**
   * 坦克與牆壁碰撞
   */
  onTankWallCollision(tank, wall) {
    // Phaser 自動處理分離

    // 水域特殊處理：阻擋坦克移動
    if (wall.type === 'water') {
      // 水域已經作為靜態物理物件，會自動阻擋
    }

    // 如果是敵人坦克，讓 AI 改變方向
    if (tank.aiController) {
      tank.aiController.onWallHit();
    }
  }

  /**
   * 坦克與坦克碰撞
   */
  onTankTankCollision(tank1, tank2) {
    // 讓敵人 AI 改變方向
    if (tank1.aiController) {
      tank1.aiController.onTankHit();
    }
    if (tank2.aiController) {
      tank2.aiController.onTankHit();
    }
  }

  /**
   * 子彈與牆壁碰撞
   */
  onBulletWallCollision(bullet, wall) {
    if (!bullet.active) return;

    // 水域不阻擋子彈
    if (wall.type === 'water') {
      return;
    }

    // 建立碰撞火花特效
    if (this.scene.createSpark) {
      this.scene.createSpark(bullet.x, bullet.y);
    }

    // 處理牆壁損壞
    if (wall.takeDamage) {
      wall.takeDamage(bullet.damage);
    }

    // 移除子彈
    bullet.onHit();
  }

  /**
   * 子彈與坦克碰撞過濾器
   */
  bulletTankFilter(bullet, tank) {
    // 子彈必須是活躍的
    if (!bullet.active) return false;

    // 子彈不能擊中發射者
    if (bullet.owner === tank) return false;

    // 判斷子彈和坦克的陣營
    const isPlayerBullet = bullet.isPlayerBullet;
    const isPlayerTank = tank.constructor.name === 'PlayerTank';
    const isEnemyTank = tank.constructor.name === 'EnemyTank';

    // 敵人的子彈不能擊中敵人坦克（防止友軍傷害）
    if (!isPlayerBullet && isEnemyTank) {
      return false;
    }

    // 玩家的子彈不能擊中玩家坦克（防止自傷）
    if (isPlayerBullet && isPlayerTank) {
      return false;
    }

    // 只有不同陣營才能造成傷害
    // 玩家子彈可以擊中敵人，敵人子彈可以擊中玩家
    return true;
  }

  /**
   * 子彈與坦克碰撞
   */
  onBulletTankCollision(bullet, tank) {
    if (!bullet.active) return;

    // 坦克受傷
    tank.takeDamage(bullet.damage);

    // 建立擊中特效
    if (this.scene.createHitEffect) {
      this.scene.createHitEffect(tank.x, tank.y);
    }

    // 相機震動（玩家被擊中時）
    if (tank === this.scene.player) {
      this.scene.cameras.main.shake(200, 0.01);
    }

    // 移除子彈
    bullet.onHit();
  }

  /**
   * 子彈相互碰撞
   * 經典 FC 規則：只有玩家和敵人的子彈才會互相抵銷
   * 敵人之間的子彈不會抵銷
   */
  onBulletBulletCollision(bullet1, bullet2) {
    if (!bullet1.active || !bullet2.active || bullet1 === bullet2) {
      return;
    }

    // 檢查子彈類型：只有玩家子彈和敵人子彈才會互相抵銷
    const isPlayer1 = bullet1.isPlayerBullet;
    const isPlayer2 = bullet2.isPlayerBullet;

    // 如果兩顆都是敵人子彈，則不抵銷
    if (!isPlayer1 && !isPlayer2) {
      return;
    }

    // 如果兩顆都是玩家子彈，也不抵銷（雙人模式可能有兩個玩家）
    // 單人模式下這個情況不會發生
    if (isPlayer1 && isPlayer2) {
      return;
    }

    // 只有一方是玩家子彈，另一方是敵人子彈時才抵銷
    bullet1.onHit();
    bullet2.onHit();

    // 建立火花特效
    if (this.scene.createSpark) {
      this.scene.createSpark(
        (bullet1.x + bullet2.x) / 2,
        (bullet1.y + bullet2.y) / 2
      );
    }
  }

  /**
   * 子彈與基地碰撞
   */
  onBulletBaseCollision(bullet, base) {
    if (!bullet.active) return;

    bullet.onHit();

    // 基地被摧毀
    if (base.takeDamage) {
      base.takeDamage(bullet.damage);
    }
  }

  /**
   * 玩家與道具碰撞
   */
  onPlayerPowerUpCollision(player, powerUp) {
    if (!player.active || !powerUp.active) return;

    // 顯示道具獲取提示
    if (this.scene.showPowerUpMessage) {
      this.scene.showPowerUpMessage(powerUp.powerUpType);
    }

    // 套用道具效果
    if (player.applyPowerUp) {
      player.applyPowerUp(powerUp.powerUpType);
    }

    // 播放道具收集音效
    if (this.scene.audioManager && this.scene.audioManager.playSFX) {
      this.scene.audioManager.playSFX('powerup', 0.5);
    }

    // 建立收集特效
    if (this.scene.createCollectEffect) {
      this.scene.createCollectEffect(powerUp.x, powerUp.y);
    }

    // 移除道具
    powerUp.destroy();
  }

  // ========== 輔助方法 ==========

  addPlayer(player) {
    this.playerGroup.add(player);
    // 確保世界邊界碰撞設定生效
    if (player.body) {
      player.body.setCollideWorldBounds(true);
    }
  }

  addEnemy(enemy) {
    this.enemyGroup.add(enemy);
    // 確保世界邊界碰撞設定生效
    if (enemy.body) {
      enemy.body.setCollideWorldBounds(true);
    }
  }

  addBullet(bullet) {
    this.bulletGroup.add(bullet);
  }

  addWall(wall) {
    this.wallGroup.add(wall);
  }

  addPowerUp(powerUp) {
    this.powerUpGroup.add(powerUp);
  }

  addBase(base) {
    this.baseGroup.add(base);
  }

  /**
   * 清除所有碰撞
   */
  clear() {
    if (this.playerGroup) this.playerGroup.clear(true, true);
    if (this.enemyGroup) this.enemyGroup.clear(true, true);
    if (this.bulletGroup) this.bulletGroup.clear(true, true);
    if (this.wallGroup) this.wallGroup.clear(true, true);
    if (this.powerUpGroup) this.powerUpGroup.clear(true, true);
    if (this.baseGroup) this.baseGroup.clear(true, true);
  }
}
