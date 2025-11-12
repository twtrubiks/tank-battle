/**
 * 物件池
 * 用於重複使用遊戲物件，減少 GC 壓力
 */

export default class ObjectPool {
  /**
   * 建構子
   * @param {Function} factory - 建立物件的工廠函數
   * @param {number} initialSize - 初始大小
   * @param {number} maxSize - 最大大小
   */
  constructor(factory, initialSize = 10, maxSize = 100) {
    this.factory = factory;
    this.maxSize = maxSize;
    this.pool = [];
    this.active = [];

    // 預先建立物件
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.factory());
    }
  }

  /**
   * 取得物件
   * @returns {object} 物件
   */
  get() {
    let obj;

    if (this.pool.length > 0) {
      // 從池中取出
      obj = this.pool.pop();
    } else if (this.active.length < this.maxSize) {
      // 建立新物件
      obj = this.factory();
    } else {
      // 達到上限，重用最舊的活躍物件
      obj = this.active.shift();
    }

    this.active.push(obj);
    return obj;
  }

  /**
   * 歸還物件
   * @param {object} obj - 物件
   */
  release(obj) {
    const index = this.active.indexOf(obj);

    if (index !== -1) {
      this.active.splice(index, 1);
      this.pool.push(obj);

      // 重置物件狀態
      if (obj.deactivate) {
        obj.deactivate();
      }
    }
  }

  /**
   * 清空池
   */
  clear() {
    // 清理所有物件
    [...this.pool, ...this.active].forEach(obj => {
      if (obj.destroy) {
        obj.destroy();
      }
    });

    this.pool = [];
    this.active = [];
  }

  /**
   * 取得統計資訊
   * @returns {object} 統計資訊
   */
  getStats() {
    return {
      poolSize: this.pool.length,
      activeSize: this.active.length,
      totalSize: this.pool.length + this.active.length,
      maxSize: this.maxSize
    };
  }
}
