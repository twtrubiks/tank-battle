/**
 * 存檔管理器
 * 使用 LocalStorage 儲存遊戲進度、分數等資料
 */

export default class SaveManager {
  constructor() {
    this.SAVE_KEY = 'tank_battle_save_data';
    this.defaultData = {
      highScore: 0,
      currentLevel: 1,
      unlockedLevels: [1], // 第一關預設解鎖
      totalEnemiesDestroyed: 0,
      gamesPlayed: 0,
      settings: {
        musicVolume: 0.5,
        sfxVolume: 0.7,
        difficulty: 'normal'
      },
      statistics: {
        totalPlayTime: 0,
        levelsCompleted: 0,
        bulletsShot: 0,
        powerUpsCollected: 0
      }
    };
  }

  /**
   * 載入存檔資料
   * @returns {Object} 存檔資料
   */
  load() {
    try {
      const savedData = localStorage.getItem(this.SAVE_KEY);

      if (savedData) {
        const data = JSON.parse(savedData);
        // 合併預設資料以確保新增欄位也有預設值
        return this._mergeWithDefaults(data);
      }

      // 沒有存檔，返回預設資料
      return { ...this.defaultData };
    } catch (error) {
      console.error('載入存檔失敗:', error);
      return { ...this.defaultData };
    }
  }

  /**
   * 儲存資料
   * @param {Object} data - 要儲存的資料
   * @returns {boolean} 是否儲存成功
   */
  save(data) {
    try {
      const jsonData = JSON.stringify(data);
      localStorage.setItem(this.SAVE_KEY, jsonData);
      return true;
    } catch (error) {
      console.error('儲存失敗:', error);
      return false;
    }
  }

  /**
   * 獲取最高分
   * @returns {number} 最高分
   */
  getHighScore() {
    const data = this.load();
    return data.highScore || 0;
  }

  /**
   * 更新最高分
   * @param {number} score - 新分數
   * @returns {boolean} 是否創新高
   */
  updateHighScore(score) {
    const data = this.load();
    const isNewHighScore = score > data.highScore;

    if (isNewHighScore) {
      data.highScore = score;
      this.save(data);
    }

    return isNewHighScore;
  }

  /**
   * 獲取當前關卡
   * @returns {number} 當前關卡編號
   */
  getCurrentLevel() {
    const data = this.load();
    return data.currentLevel || 1;
  }

  /**
   * 設定當前關卡
   * @param {number} level - 關卡編號
   */
  setCurrentLevel(level) {
    const data = this.load();
    data.currentLevel = level;
    this.save(data);
  }

  /**
   * 解鎖關卡
   * @param {number} level - 要解鎖的關卡編號
   */
  unlockLevel(level) {
    const data = this.load();

    if (!data.unlockedLevels.includes(level)) {
      data.unlockedLevels.push(level);
      // 保持排序
      data.unlockedLevels.sort((a, b) => a - b);
      this.save(data);
    }
  }

  /**
   * 檢查關卡是否已解鎖
   * @param {number} level - 關卡編號
   * @returns {boolean} 是否已解鎖
   */
  isLevelUnlocked(level) {
    const data = this.load();
    return data.unlockedLevels.includes(level);
  }

  /**
   * 獲取所有已解鎖的關卡
   * @returns {Array<number>} 已解鎖關卡列表
   */
  getUnlockedLevels() {
    const data = this.load();
    return data.unlockedLevels || [1];
  }

  /**
   * 完成關卡
   * @param {number} level - 完成的關卡編號
   * @param {number} score - 本局分數
   */
  completeLevel(level, score) {
    const data = this.load();

    // 更新統計
    data.statistics.levelsCompleted++;

    // 更新最高分
    if (score > data.highScore) {
      data.highScore = score;
    }

    // 解鎖下一關（如果有的話，最多到第 5 關）
    const nextLevel = level + 1;
    if (nextLevel <= 5) {
      // 內聯解鎖邏輯，避免多次 load/save
      if (!data.unlockedLevels.includes(nextLevel)) {
        data.unlockedLevels.push(nextLevel);
        data.unlockedLevels.sort((a, b) => a - b);
      }
      data.currentLevel = nextLevel;
    } else {
      // 已經是最後一關，保持在最後一關
      data.currentLevel = level;
    }

    this.save(data);
  }

  /**
   * 更新統計資料
   * @param {Object} stats - 統計資料 {enemiesDestroyed, bulletsShot, powerUpsCollected}
   */
  updateStatistics(stats) {
    const data = this.load();

    if (stats.enemiesDestroyed !== undefined) {
      data.totalEnemiesDestroyed += stats.enemiesDestroyed;
    }

    if (stats.bulletsShot !== undefined) {
      data.statistics.bulletsShot += stats.bulletsShot;
    }

    if (stats.powerUpsCollected !== undefined) {
      data.statistics.powerUpsCollected += stats.powerUpsCollected;
    }

    this.save(data);
  }

  /**
   * 記錄遊戲開始
   */
  recordGameStart() {
    const data = this.load();
    data.gamesPlayed++;
    this.save(data);
  }

  /**
   * 獲取設定
   * @returns {Object} 遊戲設定
   */
  getSettings() {
    const data = this.load();
    return data.settings || this.defaultData.settings;
  }

  /**
   * 更新設定
   * @param {Object} settings - 新設定
   */
  updateSettings(settings) {
    const data = this.load();
    data.settings = { ...data.settings, ...settings };
    this.save(data);
  }

  /**
   * 獲取統計資料
   * @returns {Object} 統計資料
   */
  getStatistics() {
    const data = this.load();
    return {
      highScore: data.highScore,
      totalEnemiesDestroyed: data.totalEnemiesDestroyed,
      gamesPlayed: data.gamesPlayed,
      levelsCompleted: data.statistics.levelsCompleted,
      bulletsShot: data.statistics.bulletsShot,
      powerUpsCollected: data.statistics.powerUpsCollected,
      unlockedLevels: data.unlockedLevels.length
    };
  }

  /**
   * 重置所有存檔資料
   */
  reset() {
    try {
      localStorage.removeItem(this.SAVE_KEY);
      return true;
    } catch (error) {
      console.error('重置存檔失敗:', error);
      return false;
    }
  }

  /**
   * 合併資料與預設值
   * @private
   */
  _mergeWithDefaults(data) {
    return {
      highScore: data.highScore !== undefined ? data.highScore : this.defaultData.highScore,
      currentLevel: data.currentLevel || this.defaultData.currentLevel,
      unlockedLevels: data.unlockedLevels || this.defaultData.unlockedLevels,
      totalEnemiesDestroyed: data.totalEnemiesDestroyed || this.defaultData.totalEnemiesDestroyed,
      gamesPlayed: data.gamesPlayed || this.defaultData.gamesPlayed,
      settings: {
        ...this.defaultData.settings,
        ...(data.settings || {})
      },
      statistics: {
        ...this.defaultData.statistics,
        ...(data.statistics || {})
      }
    };
  }

  /**
   * 匯出存檔（用於備份）
   * @returns {string} JSON 格式的存檔資料
   */
  exportSave() {
    const data = this.load();
    return JSON.stringify(data, null, 2);
  }

  /**
   * 匯入存檔（用於還原）
   * @param {string} jsonString - JSON 格式的存檔資料
   * @returns {boolean} 是否匯入成功
   */
  importSave(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      return this.save(data);
    } catch (error) {
      console.error('匯入存檔失敗:', error);
      return false;
    }
  }
}
