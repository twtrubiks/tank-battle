/**
 * 坦克基礎類別
 * 所有坦克（玩家與敵人）的父類別
 */

import Phaser from 'phaser';
import {
  TANK_CONFIG,
  DIRECTION_ANGLES,
  DIRECTION_VECTORS,
  DEPTHS
} from '../utils/Constants';

export default class Tank extends Phaser.Physics.Arcade.Sprite {
  /**
   * 建構子
   * @param {Phaser.Scene} scene - 場景實例
   * @param {number} x - X 座標
   * @param {number} y - Y 座標
   * @param {string} texture - 紋理鍵值
   */
  constructor(scene, x, y, texture) {
    super(scene, x, y, texture);

    // 加入場景
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // 基本屬性
    this.maxHealth = 1;
    this.health = 1;
    this.speed = TANK_CONFIG.PLAYER_SPEED;
    this.direction = 'up';

    // 武器屬性
    this.fireRate = TANK_CONFIG.PLAYER_FIRE_RATE;
    this.lastFired = 0;
    this.maxBullets = TANK_CONFIG.PLAYER_MAX_BULLETS;
    this.bulletSpeed = 200;
    this.bulletDamage = 1;

    // 狀態
    this.isDestroyed = false;
    this.isInvincible = false;
    this.isFrozen = false;

    // 設定深度
    this.setDepth(DEPTHS.ENTITY);

    // 初始化
    this._setupPhysics();
  }

  /**
   * 設定物理屬性
   * @private
   */
  _setupPhysics() {
    // 設定碰撞箱（略小於精靈，避免卡牆）
    // 從 28x28 縮小到 26x26，增加 2px 緩衝空間
    const bufferSize = 2; // 碰撞緩衝區
    const bodySize = TANK_CONFIG.TANK_BODY_SIZE - bufferSize;
    const bodyOffset = TANK_CONFIG.TANK_BODY_OFFSET + bufferSize / 2;

    this.body.setSize(bodySize, bodySize);
    this.body.setOffset(bodyOffset, bodyOffset);

    // 設定世界邊界碰撞
    this.setCollideWorldBounds(true);

    // 設定阻力（停止時快速減速）
    this.body.setDrag(400);

    // 防止被其他坦克推動（經典坦克大戰行為）
    this.body.pushable = false;

    // 移除彈性，避免奇怪的物理行為
    this.body.setBounce(0);
  }

  /**
   * 移動坦克
   * @param {string} direction - 方向 ('up', 'down', 'left', 'right')
   */
  move(direction) {
    if (this.isDestroyed || this.isFrozen) return;

    this.direction = direction;
    const vector = DIRECTION_VECTORS[direction];
    const angle = DIRECTION_ANGLES[direction];

    if (vector) {
      this.setVelocity(vector.x * this.speed, vector.y * this.speed);
      this.setAngle(angle);
    }
  }

  /**
   * 停止移動
   */
  stop() {
    this.setVelocity(0, 0);
  }

  /**
   * 射擊
   * @returns {Bullet|null} 子彈物件或 null
   */
  shoot() {
    if (this.isDestroyed || this.isFrozen) return null;

    const currentTime = this.scene.time.now;

    // 檢查冷卻時間
    if (currentTime - this.lastFired < this.fireRate) {
      return null;
    }

    // 檢查子彈數量限制（由場景管理）
    const activeBullets = this.scene.bullets
      .getChildren()
      .filter(bullet => bullet.active && bullet.owner === this);

    if (activeBullets.length >= this.maxBullets) {
      return null;
    }

    this.lastFired = currentTime;

    // 計算子彈發射位置
    const bulletOffset = 20;
    const vector = DIRECTION_VECTORS[this.direction];
    const bulletX = this.x + vector.x * bulletOffset;
    const bulletY = this.y + vector.y * bulletOffset;

    // 建立子彈（由場景實作）
    const bullet = this.scene.createBullet(
      bulletX,
      bulletY,
      this.direction,
      this.bulletSpeed,
      this.bulletDamage,
      this
    );

    return bullet;
  }

  /**
   * 受到傷害
   * @param {number} damage - 傷害值
   */
  takeDamage(damage) {
    if (this.isDestroyed || this.isInvincible) return;

    this.health -= damage;

    // 受傷閃爍效果
    this._flashRed();

    if (this.health <= 0) {
      this.destroy();
    }
  }

  /**
   * 受傷閃爍效果
   * @private
   */
  _flashRed() {
    this.setTint(0xff0000);

    this.scene.time.delayedCall(100, () => {
      if (this.active) {
        this.clearTint();
      }
    });
  }

  /**
   * 摧毀坦克
   */
  destroy() {
    if (this.isDestroyed) return;

    this.isDestroyed = true;

    // 建立爆炸特效（由場景實作）
    if (this.scene.createExplosion) {
      this.scene.createExplosion(this.x, this.y);
    }

    // 移除精靈
    super.destroy();
  }

  /**
   * 設定無敵狀態
   * @param {number} duration - 持續時間（毫秒）
   */
  setInvincible(duration) {
    this.isInvincible = true;

    // 閃爍效果
    this.scene.tweens.add({
      targets: this,
      alpha: 0.5,
      duration: 200,
      yoyo: true,
      repeat: Math.floor(duration / 400),
      onComplete: () => {
        if (this.active) {
          this.isInvincible = false;
          this.setAlpha(1);
        }
      }
    });
  }

  /**
   * 設定冰凍狀態
   * @param {number} duration - 持續時間（毫秒）
   */
  setFrozen(duration) {
    this.isFrozen = true;
    this.stop();
    this.setTint(0x00FFFF);

    this.scene.time.delayedCall(duration, () => {
      if (this.active) {
        this.isFrozen = false;
        this.clearTint();
      }
    });
  }

  /**
   * 每幀更新
   * @param {number} time - 遊戲開始後的總時間
   * @param {number} delta - 距離上一幀的時間差
   */
  update(time, delta) {
    // 子類別可以覆寫此方法
  }
}
