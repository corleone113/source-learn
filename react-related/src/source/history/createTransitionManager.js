import warning from './warning.js';

function createTransitionManager() { // 创建过渡管理器
  let prompt = null; // 过渡前提示信息

  function setPrompt(nextPrompt) { // 设置提示信息，返回重置提示信息的回调
    warning(prompt == null, 'A history supports only one prompt at a time'); // 提示信息只能设置一次，要更新需要先通过之前setPrompt返回的回调进行重置

    prompt = nextPrompt;

    return () => { // 重置提示信息
      if (prompt === nextPrompt) prompt = null;
    };
  }

  function confirmTransitionTo(
    location, // 过渡目标位置
    action, // 过渡类型——push,replace,pop
    getUserConfirmation, // 过渡前处理确认的回调
    callback // 决定是否发起过渡的回调
  ) {
    // TODO: If another transition starts while we're still confirming
    // the previous one, we may end up in a weird state. Figure out the
    // best way to handle this.
    if (prompt != null) {
      const result =
        typeof prompt === 'function' ? prompt(location, action) : prompt; // 如果prompt是函数则传入location和action得到确认提示信息

      if (typeof result === 'string') {
        if (typeof getUserConfirmation === 'function') { // 如果过渡确认函数有效则使用它进行过渡前确认
          getUserConfirmation(result, callback);
        } else {
          warning( // 发出警告——必须提供过渡前确认函数来使用过渡前提示信息
            false,
            'A history needs a getUserConfirmation function in order to use a prompt message'
          );

          callback(true); // 这种情况下直接发起过渡
        }
      } else { // 如果确认提示信息不是字符串，只要不是false都会发起过渡
        // Return false from a transition hook to cancel the transition.
        callback(result !== false);
      }
    } else { // 提示信息无效则直接发起过渡
      callback(true);
    }
  }

  let listeners = [];

  function appendListener(fn) { // 注册监听器，返回注销监听器的回调
    let isActive = true; // 是否是激活状态

    function listener(...args) { // 激活状态下才能执行监听器
      if (isActive) fn(...args);
    }

    listeners.push(listener); // 注册封装过的监听器

    return () => {
      isActive = false; // 注销期间处于失活状态
      listeners = listeners.filter(item => item !== listener);
    };
  }

  function notifyListeners(...args) { // 进行广播——通知监听器执行
    listeners.forEach(listener => listener(...args));
  }

  return { // 以上函数以及闭包变量组成返回的过渡管理器
    setPrompt,
    confirmTransitionTo,
    appendListener,
    notifyListeners
  };
}

export default createTransitionManager;
