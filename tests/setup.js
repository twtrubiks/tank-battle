/**
 * Jest 測試設定
 */

// 模擬 Phaser
global.Phaser = {
  Physics: {
    Arcade: {
      Sprite: class {
        constructor(scene, x, y, texture) {
          this.scene = scene;
          this.x = x;
          this.y = y;
          this.texture = texture;
          this.active = true;
          this.body = {
            setSize: jest.fn(),
            setOffset: jest.fn(),
            setDrag: jest.fn()
          };
        }

        setCollideWorldBounds() { return this; }
        setVelocity() { return this; }
        setAngle() { return this; }
        setTint() { return this; }
        clearTint() { return this; }
        setAlpha() { return this; }
        setDepth() { return this; }
        destroy() { this.active = false; }
      }
    }
  },
  Math: {
    Distance: {
      Between: (x1, y1, x2, y2) => {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
      }
    }
  },
  Utils: {
    Array: {
      GetRandom: (array) => array[Math.floor(Math.random() * array.length)]
    }
  },
  Scene: class {}
};

// 模擬瀏覽器 API
global.requestAnimationFrame = (callback) => setTimeout(callback, 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);

// 模擬 Web Audio API
global.AudioContext = class {
  createOscillator() { return { connect: jest.fn(), start: jest.fn() }; }
  createGain() { return { connect: jest.fn(), gain: { value: 1 } }; }
  get destination() { return {}; }
};
