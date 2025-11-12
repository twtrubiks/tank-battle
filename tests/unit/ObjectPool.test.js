/**
 * ObjectPool 類別單元測試
 */

class ObjectPool {
  constructor(factory, initialSize = 10, maxSize = 100) {
    this.factory = factory;
    this.maxSize = maxSize;
    this.pool = [];
    this.active = [];

    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.factory());
    }
  }

  get() {
    let obj;

    if (this.pool.length > 0) {
      obj = this.pool.pop();
    } else if (this.active.length < this.maxSize) {
      obj = this.factory();
    } else {
      obj = this.active.shift();
    }

    this.active.push(obj);
    return obj;
  }

  release(obj) {
    const index = this.active.indexOf(obj);

    if (index !== -1) {
      this.active.splice(index, 1);
      this.pool.push(obj);

      if (obj.deactivate) {
        obj.deactivate();
      }
    }
  }

  getStats() {
    return {
      poolSize: this.pool.length,
      activeSize: this.active.length,
      totalSize: this.pool.length + this.active.length,
      maxSize: this.maxSize
    };
  }
}

describe('ObjectPool', () => {
  let pool;
  let factory;

  beforeEach(() => {
    factory = jest.fn(() => ({
      id: Math.random(),
      deactivate: jest.fn()
    }));

    pool = new ObjectPool(factory, 5, 10);
  });

  test('應該建立初始物件', () => {
    expect(factory).toHaveBeenCalledTimes(5);
    expect(pool.pool.length).toBe(5);
  });

  test('應該能從池中取得物件', () => {
    const obj = pool.get();

    expect(obj).toBeDefined();
    expect(pool.active.length).toBe(1);
    expect(pool.pool.length).toBe(4);
  });

  test('應該能歸還物件到池', () => {
    const obj = pool.get();
    pool.release(obj);

    expect(pool.pool.length).toBe(5);
    expect(pool.active.length).toBe(0);
    expect(obj.deactivate).toHaveBeenCalled();
  });

  test('池空時應該建立新物件', () => {
    // 取出所有初始物件
    for (let i = 0; i < 5; i++) {
      pool.get();
    }

    // 再取一個，應該建立新的
    const obj = pool.get();
    expect(factory).toHaveBeenCalledTimes(6);
  });

  test('達到上限時應該重用最舊的物件', () => {
    // 取出所有物件（5 個初始 + 5 個新建 = 10 個最大值）
    const objects = [];
    for (let i = 0; i < 10; i++) {
      objects.push(pool.get());
    }

    // 再取一個，應該重用最舊的
    const obj = pool.get();
    expect(obj).toBe(objects[0]);
    expect(pool.active.length).toBe(10);
  });

  test('應該正確回報統計資訊', () => {
    pool.get();
    pool.get();

    const stats = pool.getStats();
    expect(stats.poolSize).toBe(3);
    expect(stats.activeSize).toBe(2);
    expect(stats.totalSize).toBe(5);
    expect(stats.maxSize).toBe(10);
  });
});
