/**
 * 音效生成器
 * 使用 Web Audio API 生成復古 8-bit 風格音效
 */

export default class SoundGenerator {
  /**
   * 生成射擊音效（短促的爆破聲）
   */
  static generateShootSound(scene) {
    const audioContext = scene.sound.context;
    const duration = 0.15;
    const sampleRate = audioContext.sampleRate;
    const bufferSize = sampleRate * duration;
    const buffer = audioContext.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const t = i / sampleRate;
      // 快速下降的頻率（從 800Hz 到 200Hz）
      const freq = 800 - (t * 4000);
      // 方波 + 噪音
      const square = Math.sign(Math.sin(2 * Math.PI * freq * t));
      const noise = (Math.random() * 2 - 1) * 0.3;
      // 快速衰減的包絡
      const envelope = Math.exp(-t * 20);

      data[i] = (square * 0.7 + noise) * envelope * 0.3;
    }

    return buffer;
  }

  /**
   * 生成爆炸音效（更長的爆破聲）
   */
  static generateExplosionSound(scene) {
    const audioContext = scene.sound.context;
    const duration = 0.4;
    const sampleRate = audioContext.sampleRate;
    const bufferSize = sampleRate * duration;
    const buffer = audioContext.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const t = i / sampleRate;
      // 低頻爆炸聲（從 300Hz 快速降到 50Hz）
      const freq = 300 * Math.exp(-t * 8);
      const noise = (Math.random() * 2 - 1);
      const rumble = Math.sin(2 * Math.PI * freq * t);
      // 爆炸包絡（快速上升，慢速下降）
      const attack = Math.min(t * 50, 1);
      const decay = Math.exp(-t * 3);
      const envelope = attack * decay;

      data[i] = (noise * 0.5 + rumble * 0.5) * envelope * 0.4;
    }

    return buffer;
  }

  /**
   * 生成擊中音效（短促的碰撞聲）
   */
  static generateHitSound(scene) {
    const audioContext = scene.sound.context;
    const duration = 0.1;
    const sampleRate = audioContext.sampleRate;
    const bufferSize = sampleRate * duration;
    const buffer = audioContext.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const t = i / sampleRate;
      // 高頻撞擊聲
      const freq = 1200 - (t * 3000);
      const noise = (Math.random() * 2 - 1);
      const tone = Math.sin(2 * Math.PI * freq * t);
      // 超快速衰減
      const envelope = Math.exp(-t * 30);

      data[i] = (noise * 0.6 + tone * 0.4) * envelope * 0.25;
    }

    return buffer;
  }

  /**
   * 生成道具收集音效（向上的音階）
   */
  static generatePowerUpSound(scene) {
    const audioContext = scene.sound.context;
    const duration = 0.3;
    const sampleRate = audioContext.sampleRate;
    const bufferSize = sampleRate * duration;
    const buffer = audioContext.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const t = i / sampleRate;
      // 向上的音階（C5 -> E5 -> G5）
      let freq;
      if (t < 0.1) {
        freq = 523; // C5
      } else if (t < 0.2) {
        freq = 659; // E5
      } else {
        freq = 784; // G5
      }

      // 方波音色（8-bit 風格）
      const square = Math.sign(Math.sin(2 * Math.PI * freq * t));
      // 包絡
      const envelope = 1 - (t / duration);

      data[i] = square * envelope * 0.25;
    }

    return buffer;
  }

  /**
   * 生成坦克移動音效（低頻引擎聲）
   */
  static generateMoveSound(scene) {
    const audioContext = scene.sound.context;
    const duration = 0.5;
    const sampleRate = audioContext.sampleRate;
    const bufferSize = sampleRate * duration;
    const buffer = audioContext.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const t = i / sampleRate;
      // 低頻引擎隆隆聲
      const freq = 80 + Math.sin(t * 10) * 10;
      const rumble = Math.sin(2 * Math.PI * freq * t);
      const noise = (Math.random() * 2 - 1) * 0.3;
      // 平穩的包絡
      const envelope = 0.5;

      data[i] = (rumble * 0.7 + noise * 0.3) * envelope * 0.15;
    }

    return buffer;
  }

  /**
   * 生成遊戲開始音效
   */
  static generateGameStartSound(scene) {
    const audioContext = scene.sound.context;
    const duration = 0.5;
    const sampleRate = audioContext.sampleRate;
    const bufferSize = sampleRate * duration;
    const buffer = audioContext.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const t = i / sampleRate;
      // 向上的琶音
      let freq;
      if (t < 0.125) freq = 262; // C4
      else if (t < 0.25) freq = 330; // E4
      else if (t < 0.375) freq = 392; // G4
      else freq = 523; // C5

      const square = Math.sign(Math.sin(2 * Math.PI * freq * t));
      const envelope = 1 - (t / duration) * 0.5;

      data[i] = square * envelope * 0.2;
    }

    return buffer;
  }

  /**
   * 生成敵人被摧毀音效
   */
  static generateEnemyDestroySound(scene) {
    const audioContext = scene.sound.context;
    const duration = 0.35;
    const sampleRate = audioContext.sampleRate;
    const bufferSize = sampleRate * duration;
    const buffer = audioContext.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const t = i / sampleRate;
      // 下降的音調
      const freq = 600 * Math.exp(-t * 6);
      const square = Math.sign(Math.sin(2 * Math.PI * freq * t));
      const noise = (Math.random() * 2 - 1) * 0.4;
      const envelope = Math.exp(-t * 5);

      data[i] = (square * 0.6 + noise * 0.4) * envelope * 0.35;
    }

    return buffer;
  }

  /**
   * 將 AudioBuffer 添加到場景的音效快取
   */
  static addBufferToCache(scene, key, buffer) {
    // 創建一個臨時的音頻源來儲存
    const source = scene.sound.context.createBufferSource();
    source.buffer = buffer;

    // 添加到 Phaser 的音效系統
    if (!scene.cache.audio.exists(key)) {
      scene.cache.audio.add(key, buffer);
    }
  }

  /**
   * 生成所有遊戲音效
   */
  static generateAllSounds(scene) {
    const sounds = {
      'shoot': this.generateShootSound(scene),
      'explosion': this.generateExplosionSound(scene),
      'hit': this.generateHitSound(scene),
      'powerup': this.generatePowerUpSound(scene),
      'move': this.generateMoveSound(scene),
      'gamestart': this.generateGameStartSound(scene),
      'enemydestroy': this.generateEnemyDestroySound(scene)
    };

    // 添加到快取
    for (const [key, buffer] of Object.entries(sounds)) {
      this.addBufferToCache(scene, key, buffer);
    }

    return sounds;
  }
}
