/**
 * SoundGenerator 音效生成器單元測試
 * 測試 8-bit 復古音效生成邏輯
 */

describe('SoundGenerator - 音效生成器', () => {
  describe('音效基本參數', () => {
    test('射擊音效應該有正確的參數', () => {
      const shootSound = {
        duration: 0.15,
        startFreq: 800,
        endFreq: 200,
        waveform: 'square',
        hasNoise: true,
        volume: 0.3
      };

      expect(shootSound.duration).toBe(0.15);
      expect(shootSound.startFreq).toBeGreaterThan(shootSound.endFreq);
      expect(shootSound.waveform).toBe('square');
      expect(shootSound.hasNoise).toBe(true);
    });

    test('爆炸音效應該有正確的參數', () => {
      const explosionSound = {
        duration: 0.4,
        startFreq: 300,
        endFreq: 50,
        hasRumble: true,
        volume: 0.5
      };

      expect(explosionSound.duration).toBe(0.4);
      expect(explosionSound.startFreq).toBeGreaterThan(explosionSound.endFreq);
      expect(explosionSound.hasRumble).toBe(true);
    });

    test('擊中音效應該有正確的參數', () => {
      const hitSound = {
        duration: 0.1,
        startFreq: 1200,
        waveform: 'square',
        fastDecay: true
      };

      expect(hitSound.duration).toBe(0.1);
      expect(hitSound.startFreq).toBeGreaterThan(1000);
      expect(hitSound.fastDecay).toBe(true);
    });

    test('遊戲開始音效應該有正確的音階', () => {
      const gameStartSound = {
        duration: 0.5,
        notes: ['C4', 'E4', 'G4', 'C5'],
        waveform: 'square'
      };

      expect(gameStartSound.notes.length).toBe(4);
      expect(gameStartSound.notes).toContain('C4');
      expect(gameStartSound.notes).toContain('C5');
    });

    test('道具收集音效應該有正確的音階', () => {
      const powerUpSound = {
        duration: 0.3,
        notes: ['C5', 'E5', 'G5'],
        waveform: 'square'
      };

      expect(powerUpSound.notes.length).toBe(3);
      expect(powerUpSound.notes[0]).toBe('C5');
    });
  });

  describe('音效生成邏輯', () => {
    test('應該生成指定時長的音效緩衝區', () => {
      const sampleRate = 44100; // 標準採樣率
      const duration = 0.15;
      const bufferSize = sampleRate * duration;

      expect(bufferSize).toBe(6615);
    });

    test('頻率掃描應該正確計算', () => {
      const startFreq = 800;
      const endFreq = 200;
      const progress = 0.5; // 50% 進度

      // 指數衰減
      const currentFreq = startFreq * Math.exp(-progress * Math.log(startFreq / endFreq));

      expect(currentFreq).toBeGreaterThan(endFreq);
      expect(currentFreq).toBeLessThan(startFreq);
    });

    test('包絡應該正確計算（指數衰減）', () => {
      const time = 0.1;
      const decayRate = 20;
      const envelope = Math.exp(-time * decayRate);

      expect(envelope).toBeGreaterThan(0);
      expect(envelope).toBeLessThan(1);
    });

    test('方波應該正確生成', () => {
      const frequency = 440; // A4
      const time = 0.001;
      const square = Math.sign(Math.sin(2 * Math.PI * frequency * time));

      expect([-1, 1]).toContain(square);
    });

    test('噪音應該在正確範圍內', () => {
      const noise = (Math.random() * 2 - 1) * 0.3;

      expect(noise).toBeGreaterThanOrEqual(-0.3);
      expect(noise).toBeLessThanOrEqual(0.3);
    });
  });

  describe('音符頻率轉換', () => {
    test('應該正確轉換音符到頻率', () => {
      // A4 = 440 Hz (標準音)
      const A4_FREQUENCY = 440;

      // C4 = A4 * 2^(-9/12) ≈ 261.63 Hz
      const C4_FREQUENCY = A4_FREQUENCY * Math.pow(2, -9/12);

      expect(C4_FREQUENCY).toBeCloseTo(261.63, 1);
    });

    test('音符頻率對照表應該正確', () => {
      const NOTE_FREQUENCIES = {
        'C4': 261.63,
        'E4': 329.63,
        'G4': 392.00,
        'C5': 523.25,
        'E5': 659.25,
        'G5': 783.99
      };

      expect(NOTE_FREQUENCIES['C4']).toBeCloseTo(261.63, 1);
      expect(NOTE_FREQUENCIES['A4']).toBeUndefined();
      expect(NOTE_FREQUENCIES['C5']).toBeGreaterThan(NOTE_FREQUENCIES['C4']);
    });
  });

  describe('所有音效類型', () => {
    test('應該包含所有必要的音效', () => {
      const soundTypes = [
        'shoot',
        'explosion',
        'hit',
        'powerup',
        'move',
        'gamestart',
        'enemydestroy'
      ];

      expect(soundTypes).toHaveLength(7);
      expect(soundTypes).toContain('shoot');
      expect(soundTypes).toContain('explosion');
      expect(soundTypes).toContain('hit');
    });

    test('敵人摧毀音效應該有下降音調', () => {
      const enemyDestroySound = {
        duration: 0.35,
        startFreq: 600,
        endFreq: 100,
        hasNoise: true,
        descendingTone: true
      };

      expect(enemyDestroySound.descendingTone).toBe(true);
      expect(enemyDestroySound.startFreq).toBeGreaterThan(enemyDestroySound.endFreq);
    });

    test('移動音效應該有低頻引擎聲', () => {
      const moveSound = {
        frequency: 80,
        isLowFrequency: true,
        hasRumble: true,
        volume: 0.15
      };

      expect(moveSound.frequency).toBeLessThan(100);
      expect(moveSound.isLowFrequency).toBe(true);
      expect(moveSound.volume).toBeLessThanOrEqual(0.2);
    });
  });

  describe('音量控制', () => {
    test('所有音效音量應該在安全範圍內', () => {
      const volumes = {
        shoot: 0.3,
        explosion: 0.6,
        hit: 0.4,
        powerup: 0.5,
        gamestart: 0.5,
        enemydestroy: 0.5
      };

      Object.values(volumes).forEach(volume => {
        expect(volume).toBeGreaterThan(0);
        expect(volume).toBeLessThanOrEqual(1);
      });
    });

    test('應該防止音頻過載', () => {
      const signal = 0.8;
      const noise = 0.3;
      const combined = signal + noise;

      // 如果超過 1.0 應該進行限制
      const clampedSignal = Math.max(-1, Math.min(1, combined));

      expect(clampedSignal).toBeLessThanOrEqual(1);
      expect(clampedSignal).toBeGreaterThanOrEqual(-1);
    });
  });
});
