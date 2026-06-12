/**
 * Phaser 模組 mock（單元測試用）
 * 讓 `import Phaser from 'phaser'` 在 Jest 中載入輕量替身，
 * 使 entities / systems 模組可以直接以真實實作進行單元測試。
 */

class MockBody {
  constructor() {
    this.velocity = { x: 0, y: 0 };
    this.drag = { x: 0, y: 0 };
    this.pushable = true;
    this.enable = true;
    this.blocked = { up: false, down: false, left: false, right: false, none: true };
  }

  setSize() { return this; }
  setOffset() { return this; }

  setDrag(x, y = x) {
    this.drag.x = x;
    this.drag.y = y;
    return this;
  }

  setVelocity(x, y = x) {
    this.velocity.x = x;
    this.velocity.y = y;
    return this;
  }

  setBounce() { return this; }
  setCollideWorldBounds() { return this; }
}

class MockGameObject {
  constructor(scene, x, y, texture) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.texture = texture;
    this.width = 32;
    this.height = 32;
    this.active = true;
    this.visible = true;
    this.alpha = 1;
    this.angle = 0;
    this.depth = 0;
  }

  setDepth(d) { this.depth = d; return this; }
  setAlpha(a) { this.alpha = a; return this; }
  setAngle(a) { this.angle = a; return this; }
  setTint(tint) { this.tintTopLeft = tint; return this; }
  clearTint() { this.tintTopLeft = undefined; return this; }
  setPosition(x, y) { this.x = x; this.y = y; return this; }
  setActive(v) { this.active = v; return this; }
  setVisible(v) { this.visible = v; return this; }
  setOrigin() { return this; }
  setScrollFactor() { return this; }

  getBounds() {
    return {
      x: this.x - this.width / 2,
      y: this.y - this.height / 2,
      width: this.width,
      height: this.height,
      right: this.x + this.width / 2,
      bottom: this.y + this.height / 2
    };
  }

  destroy() {
    this.active = false;
    this.destroyed = true;
  }
}

class MockArcadeSprite extends MockGameObject {
  constructor(scene, x, y, texture) {
    super(scene, x, y, texture);
    this.body = new MockBody();
  }

  setVelocity(x, y = x) {
    if (this.body) {
      this.body.setVelocity(x, y);
    }
    return this;
  }

  setCollideWorldBounds() { return this; }

  preUpdate() {}
}

const Phaser = {
  AUTO: 0,

  Scene: class MockScene {
    constructor(config) {
      this.sceneConfig = config;
    }
  },

  GameObjects: {
    Sprite: MockGameObject
  },

  Physics: {
    Arcade: {
      Sprite: MockArcadeSprite
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
      GetRandom: (array) => array[Math.floor(Math.random() * array.length)],
      Shuffle: (array) => {
        for (let i = array.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
      }
    }
  },

  Geom: {
    Intersects: {
      RectangleToRectangle: (a, b) =>
        !(b.x >= a.x + a.width ||
          b.x + b.width <= a.x ||
          b.y >= a.y + a.height ||
          b.y + b.height <= a.y)
    }
  },

  Input: {
    Keyboard: {
      KeyCodes: { SPACE: 32, P: 80, TAB: 9 },
      JustDown: () => false
    }
  },

  Scale: {
    FIT: 0,
    CENTER_BOTH: 0
  }
};

module.exports = Phaser;
module.exports.default = Phaser;
