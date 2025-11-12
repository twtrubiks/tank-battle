/**
 * 玩家坦克類別
 */

import Tank from './Tank';
import { TANK_CONFIG, POWERUP_TYPES, EVENTS } from '../utils/Constants';

export default class PlayerTank extends Tank {
  constructor(scene, x, y) {
    super(scene, x, y, 'player_tank');

    // 玩家特有屬性
    this.lives = TANK_CONFIG.PLAYER_LIVES;
    this.score = 0;

    // 星星升級等級（0-4）
    this.starLevel = 0;
    this.baseSpeed = TANK_CONFIG.PLAYER_SPEED;

    // 道具效果
    this.powerUps = {
      shield: false,
      rapidFire: false,
      powerBullet: false,
      speedBoost: false
    };

    // 護盾精靈
    this.shieldSprite = null;

    // 設定玩家速度
    this.speed = this.baseSpeed;

    // 生成時短暫無敵
    this.setInvincible(3000);
  }

  /**
   * 套用道具效果
   * @param {string} type - 道具類型
   */
  applyPowerUp(type) {
    switch (type) {
    case POWERUP_TYPES.TANK.key:
      this._applyExtraLife();
      break;

    case POWERUP_TYPES.STAR.key:
      this._applyStarUpgrade();
      break;

    case POWERUP_TYPES.GRENADE.key:
      this._applyGrenade();
      break;

    case POWERUP_TYPES.SHOVEL.key:
      this._applyBaseProtection();
      break;

    case POWERUP_TYPES.HELMET.key:
      this._applyShield();
      break;

    case POWERUP_TYPES.CLOCK.key:
      this._applyFreeze();
      break;
    }

    // 發送道具收集事件
    this.scene.events.emit(EVENTS.POWERUP_COLLECTED, type);
  }

  /**
   * 額外生命
   * @private
   */
  _applyExtraLife() {
    this.lives++;
    this.scene.events.emit(EVENTS.LIVES_CHANGED, this.lives);
  }

  /**
   * 星星升級（經典 FC 模式）
   * @private
   */
  _applyStarUpgrade() {
    // 最多升到 4 級
    if (this.starLevel >= 4) {
      return;
    }

    this.starLevel++;

    // 根據等級套用效果
    switch (this.starLevel) {
    case 1:
      // Level 1: 提升移動速度
      this.speed = this.baseSpeed * 1.3;
      console.log('⭐ 星星 Level 1：移動速度提升！');
      break;

    case 2:
      // Level 2: 增加同時射擊數（可發射 2 顆子彈）
      this.maxBullets = 2;
      console.log('⭐⭐ 星星 Level 2：可同時發射 2 顆子彈！');
      break;

    case 3:
      // Level 3: 子彈可破壞鋼牆（傷害值提升）
      this.bulletDamage = 2;
      console.log('⭐⭐⭐ 星星 Level 3：子彈可破壞鋼牆！');
      break;

    case 4:
      // Level 4: 裝甲坦克（短暫無敵護盾）
      this.maxBullets = 3;
      this._applyArmorShield();
      console.log('⭐⭐⭐⭐ 星星 Level 4：裝甲坦克！最大火力！');
      break;
    }

    // 發送星星升級事件
    this.scene.events.emit(EVENTS.STAR_UPGRADED, this.starLevel);
  }

  /**
   * 裝甲護盾（第 4 級星星效果）
   * @private
   */
  _applyArmorShield() {
    // 給予短暫護盾效果
    if (!this.shieldSprite) {
      this.shieldSprite = this.scene.add.circle(
        this.x,
        this.y,
        24,
        0xFFD700, // 金色
        0.3
      );
      this.shieldSprite.setStrokeStyle(2, 0xFFD700);
      this.shieldSprite.setDepth(this.depth + 1);

      // 護盾動畫
      this.scene.tweens.add({
        targets: this.shieldSprite,
        alpha: 0.5,
        duration: 300,
        yoyo: true,
        repeat: -1
      });
    }

    // 裝甲護盾持續 5 秒
    this.setInvincible(5000);

    this.scene.time.delayedCall(5000, () => {
      if (this.shieldSprite && !this.powerUps.shield) {
        this.shieldSprite.destroy();
        this.shieldSprite = null;
      }
    });
  }

  /**
   * 消滅所有敵人
   * @private
   */
  _applyGrenade() {
    if (this.scene.destroyAllEnemies) {
      this.scene.destroyAllEnemies();
    }
  }

  /**
   * 基地防護
   * @private
   */
  _applyBaseProtection() {
    if (this.scene.activateBaseProtection) {
      this.scene.activateBaseProtection(POWERUP_TYPES.SHOVEL.duration);
    }
  }

  /**
   * 護盾
   * @private
   */
  _applyShield() {
    this.powerUps.shield = true;
    this.setInvincible(POWERUP_TYPES.HELMET.duration);

    // 建立護盾精靈
    if (!this.shieldSprite) {
      this.shieldSprite = this.scene.add.circle(
        this.x,
        this.y,
        24,
        0x00FFFF,
        0.3
      );
      this.shieldSprite.setStrokeStyle(2, 0x00FFFF);
      this.shieldSprite.setDepth(this.depth + 1);

      // 護盾動畫（旋轉脈衝）
      this.scene.tweens.add({
        targets: this.shieldSprite,
        alpha: 0.5,
        duration: 500,
        yoyo: true,
        repeat: -1
      });
    }

    // 定時移除護盾
    this.scene.time.delayedCall(POWERUP_TYPES.HELMET.duration, () => {
      this._removeShield();
    });
  }

  /**
   * 移除護盾
   * @private
   */
  _removeShield() {
    this.powerUps.shield = false;

    if (this.shieldSprite) {
      this.shieldSprite.destroy();
      this.shieldSprite = null;
    }
  }

  /**
   * 冰凍所有敵人
   * @private
   */
  _applyFreeze() {
    if (this.scene.freezeAllEnemies) {
      this.scene.freezeAllEnemies(POWERUP_TYPES.CLOCK.duration);
    }
  }

  /**
   * 玩家受傷（考慮護盾）
   * @param {number} damage - 傷害值
   */
  takeDamage(damage) {
    // 檢查護盾
    if (this.powerUps.shield || this.isInvincible) {
      return;
    }

    // 扣血
    this.health -= damage;
    this._flashRed();

    // 發送受傷事件
    this.scene.events.emit(EVENTS.PLAYER_HIT);

    if (this.health <= 0) {
      this._onDeath();
    }
  }

  /**
   * 玩家死亡處理
   * @private
   */
  _onDeath() {
    this.lives--;
    this.scene.events.emit(EVENTS.LIVES_CHANGED, this.lives);

    if (this.lives > 0) {
      // 還有生命，重生
      this.scene.events.emit(EVENTS.PLAYER_DESTROYED, false);
      if (this.scene.respawnPlayer) {
        this.scene.respawnPlayer();
      }
    } else {
      // 遊戲結束
      this.scene.events.emit(EVENTS.PLAYER_DESTROYED, true);
      if (this.scene.gameOver) {
        this.scene.gameOver();
      }
    }

    this.destroy();
  }

  /**
   * 增加分數
   * @param {number} points - 分數
   */
  addScore(points) {
    this.score += points;
    this.scene.events.emit(EVENTS.SCORE_CHANGED, this.score);
  }

  /**
   * 更新護盾位置
   * @param {number} time - 遊戲時間
   * @param {number} delta - 時間差
   */
  update(time, delta) {
    super.update(time, delta);

    // 更新護盾位置跟隨坦克
    if (this.shieldSprite && this.active) {
      this.shieldSprite.setPosition(this.x, this.y);
    }
  }

  /**
   * 摧毀時清理資源
   */
  destroy() {
    this._removeShield();
    super.destroy();
  }
}
