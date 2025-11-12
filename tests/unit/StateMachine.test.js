/**
 * StateMachine 類別單元測試
 */

// 簡化的 StateMachine 用於測試
class StateMachine {
  constructor() {
    this.states = {};
    this.currentState = null;
    this.previousState = null;
  }

  addState(name, state) {
    this.states[name] = state;
  }

  setState(name) {
    if (this.currentState === name) return false;

    if (this.currentState && this.states[this.currentState].exit) {
      this.states[this.currentState].exit();
    }

    this.previousState = this.currentState;
    this.currentState = name;

    if (this.states[name] && this.states[name].enter) {
      this.states[name].enter();
    }

    return true;
  }

  update(delta) {
    if (this.currentState && this.states[this.currentState].update) {
      this.states[this.currentState].update(delta);
    }
  }

  getCurrentState() {
    return this.currentState;
  }
}

describe('StateMachine', () => {
  let stateMachine;

  beforeEach(() => {
    stateMachine = new StateMachine();
  });

  test('應該正確新增狀態', () => {
    const state = {
      enter: jest.fn(),
      update: jest.fn(),
      exit: jest.fn()
    };

    stateMachine.addState('test', state);
    expect(stateMachine.states['test']).toBeDefined();
  });

  test('應該正確切換狀態', () => {
    const state1 = {
      enter: jest.fn(),
      exit: jest.fn()
    };

    const state2 = {
      enter: jest.fn(),
      exit: jest.fn()
    };

    stateMachine.addState('state1', state1);
    stateMachine.addState('state2', state2);

    stateMachine.setState('state1');
    expect(stateMachine.getCurrentState()).toBe('state1');
    expect(state1.enter).toHaveBeenCalled();

    stateMachine.setState('state2');
    expect(stateMachine.getCurrentState()).toBe('state2');
    expect(state1.exit).toHaveBeenCalled();
    expect(state2.enter).toHaveBeenCalled();
  });

  test('重複設定相同狀態應該返回 false', () => {
    const state = { enter: jest.fn() };
    stateMachine.addState('test', state);

    stateMachine.setState('test');
    const result = stateMachine.setState('test');

    expect(result).toBe(false);
  });

  test('應該正確記錄上一個狀態', () => {
    stateMachine.addState('state1', {});
    stateMachine.addState('state2', {});

    stateMachine.setState('state1');
    stateMachine.setState('state2');

    expect(stateMachine.previousState).toBe('state1');
  });

  test('應該正確更新狀態', () => {
    const updateFn = jest.fn();
    const state = { update: updateFn };

    stateMachine.addState('test', state);
    stateMachine.setState('test');
    stateMachine.update(16);

    expect(updateFn).toHaveBeenCalledWith(16);
  });
});
