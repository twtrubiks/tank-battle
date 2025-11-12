/**
 * 子彈類別
 */

import Phaser from 'phaser';
import { BULLET_CONFIG, DIRECTION_VECTORS, DEPTHS } from '../utils/Constants';

export default class Bullet extends Phaser.Physics.Arcade.Sprite {
  /**
   * 建構子
   * @param {Phaser.Scene} scene - 場景
   * @param {number} x - X 座標
   * @param {number} y - Y 座標
   */
  constructor(scene, x, y) {
    super(scene, x, y, 'bullet');

    // 只加入顯示，不創建 physics body（讓 group 處理）
    scene.add.existing(this);
    // 注意：不調用 scene.physics.add.existing，讓 bulletGroup 來創建 body

    // 子彈屬性
    this.speed = BULLET_CONFIG.SPEED;
    this.damage = BULLET_CONFIG.DAMAGE;
    this.direction = 'up';
    this.owner = null;
    this.isPlayerBullet = false;

    // 設定深度
    this.setDepth(DEPTHS.ENTITY);

    // 預設為不活躍
    this.setActive(false);
    this.setVisible(false);
  }

  /**
   * 發射子彈
   * @param {number} x - X 座標
   * @param {number} y - Y 座標
   * @param {string} direction - 方向
   * @param {number} speed - 速度
   * @param {number} damage - 傷害
   * @param {Tank} owner - 發射者
   */
  fire(x, y, direction, speed, damage, owner) {
    // 設定位置
    this.setPosition(x, y);

    // 設定屬性
    this.direction = direction;
    this.speed = speed;
    this.damage = damage;
    this.owner = owner;
    this.isPlayerBullet = owner && owner.constructor.name === 'PlayerTank';

    // 設定顏色
    const color = this.isPlayerBullet
      ? BULLET_CONFIG.PLAYER_COLOR
      : BULLET_CONFIG.ENEMY_COLOR;
    this.setTint(color);

    // 啟用顯示
    this.setActive(true);
    this.setVisible(true);

    // 設定角度
    const angle = direction === 'up' ? 0 :
      direction === 'down' ? 180 :
        direction === 'left' ? 270 : 90;
    this.setAngle(angle);

    // 設定速度（body 由 bulletGroup 創建，此時應該已經存在）
    if (this.body) {
      // 設定碰撞箱大小（group 創建 body 後需要配置）
      this.body.setSize(BULLET_CONFIG.SIZE, BULLET_CONFIG.SIZE);

      // 計算並設定速度
      const vector = DIRECTION_VECTORS[direction];
      if (vector) {
        const vx = vector.x * this.speed;
        const vy = vector.y * this.speed;
        this.body.setVelocity(vx, vy);

        // Debug: 確認速度已設定
        console.log(`Bullet fired: direction=${direction}, vx=${vx}, vy=${vy}, body.velocity=(${this.body.velocity.x}, ${this.body.velocity.y})`);
      }
    } else {
      console.warn('Bullet has no body! Make sure it\'s added to bulletGroup first.');
    }

    // 播放音效（如果有音效管理器）
    if (this.scene.audioManager && this.scene.audioManager.playSFX) {
      this.scene.audioManager.playSFX('shoot');
    }
  }

  /**
   * 每幀更新
   */
  preUpdate(time, delta) {
    super.preUpdate(time, delta);

    // 檢查是否超出世界邊界
    if (!this.scene.physics.world.bounds.contains(this.x, this.y)) {
      this.deactivate();
    }
  }

  /**
   * 停用子彈（回收到物件池）
   */
  deactivate() {
    this.setActive(false);
    this.setVisible(false);

    // 停止移動
    if (this.body) {
      this.body.setVelocity(0, 0);
      // 注意：不要設 enable = false，因為會影響物件池重用
      // 只要設 velocity = 0 就能停止移動
    }

    this.owner = null;
  }

  /**
   * 擋中目標
   */
  onHit() {
    // 建立擊中特效
    if (this.scene.createHitEffect) {
      this.scene.createHitEffect(this.x, this.y);
    }

    this.deactivate();
  }
}
