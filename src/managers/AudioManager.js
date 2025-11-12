/**
 * 音效管理器
 * 管理所有音效與音樂
 */

export default class AudioManager {
  /**
   * 建構子
   * @param {Phaser.Scene} scene - 場景
   */
  constructor(scene) {
    this.scene = scene;

    // 音效設定
    this.sfxVolume = 0.5;
    this.musicVolume = 0.3;
    this.isMuted = false;

    // 當前播放的音樂
    this.currentMusic = null;

    // 音效快取
    this.sounds = {};
  }

  /**
   * 播放音效
   * @param {string} key - 音效鍵值
   * @param {number} volume - 音量（可選）
   */
  playSFX(key, volume = this.sfxVolume) {
    if (this.isMuted) return;

    // 檢查音效是否已載入
    if (!this.scene.cache.audio.exists(key)) {
      // 音效未載入，跳過
      return;
    }

    // 播放音效
    this.scene.sound.play(key, {
      volume: volume
    });
  }

  /**
   * 播放背景音樂
   * @param {string} key - 音樂鍵值
   * @param {boolean} loop - 是否循環
   */
  playMusic(key, loop = true) {
    if (this.isMuted) return;

    // 停止當前音樂
    if (this.currentMusic) {
      this.currentMusic.stop();
    }

    // 檢查音樂是否已載入
    if (!this.scene.cache.audio.exists(key)) {
      return;
    }

    // 播放新音樂
    this.currentMusic = this.scene.sound.add(key, {
      volume: this.musicVolume,
      loop: loop
    });

    this.currentMusic.play();
  }

  /**
   * 停止音樂
   */
  stopMusic() {
    if (this.currentMusic) {
      this.currentMusic.stop();
      this.currentMusic = null;
    }
  }

  /**
   * 暫停音樂
   */
  pauseMusic() {
    if (this.currentMusic) {
      this.currentMusic.pause();
    }
  }

  /**
   * 繼續音樂
   */
  resumeMusic() {
    if (this.currentMusic) {
      this.currentMusic.resume();
    }
  }

  /**
   * 設定靜音
   * @param {boolean} muted - 是否靜音
   */
  setMuted(muted) {
    this.isMuted = muted;

    if (muted) {
      this.scene.sound.mute = true;
    } else {
      this.scene.sound.mute = false;
    }
  }

  /**
   * 設定音效音量
   * @param {number} volume - 音量 (0-1)
   */
  setSFXVolume(volume) {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
  }

  /**
   * 設定音樂音量
   * @param {number} volume - 音量 (0-1)
   */
  setMusicVolume(volume) {
    this.musicVolume = Math.max(0, Math.min(1, volume));

    if (this.currentMusic) {
      this.currentMusic.setVolume(this.musicVolume);
    }
  }

  /**
   * 清理
   */
  destroy() {
    this.stopMusic();
    this.sounds = {};
  }
}
