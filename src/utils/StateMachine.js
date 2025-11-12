/**
 * 狀態機
 * 用於管理遊戲物件的狀態轉換
 */

export default class StateMachine {
  constructor() {
    this.states = {};
    this.currentState = null;
    this.previousState = null;
    this.context = null;
  }

  /**
   * 設定上下文（狀態機所屬的物件）
   * @param {object} context - 上下文物件
   */
  setContext(context) {
    this.context = context;
  }

  /**
   * 新增狀態
   * @param {string} name - 狀態名稱
   * @param {object} state - 狀態物件（包含 enter, update, exit 方法）
   */
  addState(name, state) {
    // 綁定上下文
    if (state.enter) state.enter = state.enter.bind(this.context);
    if (state.update) state.update = state.update.bind(this.context);
    if (state.exit) state.exit = state.exit.bind(this.context);

    this.states[name] = state;
  }

  /**
   * 切換狀態
   * @param {string} name - 目標狀態名稱
   * @param  {...any} args - 傳遞給 enter 的參數
   * @returns {boolean} 是否成功切換
   */
  setState(name, ...args) {
    if (!this.states[name]) {
      console.warn(`State "${name}" does not exist`);
      return false;
    }

    if (this.currentState === name) {
      return false;
    }

    // 離開當前狀態
    if (this.currentState && this.states[this.currentState].exit) {
      this.states[this.currentState].exit();
    }

    this.previousState = this.currentState;
    this.currentState = name;

    // 進入新狀態
    if (this.states[name].enter) {
      this.states[name].enter(...args);
    }

    return true;
  }

  /**
   * 更新當前狀態
   * @param {number} delta - 時間差
   */
  update(delta) {
    if (this.currentState && this.states[this.currentState].update) {
      this.states[this.currentState].update(delta);
    }
  }

  /**
   * 取得當前狀態名稱
   * @returns {string} 當前狀態
   */
  getCurrentState() {
    return this.currentState;
  }

  /**
   * 取得上一個狀態名稱
   * @returns {string} 上一個狀態
   */
  getPreviousState() {
    return this.previousState;
  }

  /**
   * 回到上一個狀態
   * @returns {boolean} 是否成功
   */
  revertToPrevious() {
    if (this.previousState) {
      return this.setState(this.previousState);
    }
    return false;
  }

  /**
   * 檢查是否在某個狀態
   * @param {string} name - 狀態名稱
   * @returns {boolean}
   */
  isInState(name) {
    return this.currentState === name;
  }

  /**
   * 重置狀態機
   */
  reset() {
    if (this.currentState && this.states[this.currentState].exit) {
      this.states[this.currentState].exit();
    }

    this.currentState = null;
    this.previousState = null;
  }
}
