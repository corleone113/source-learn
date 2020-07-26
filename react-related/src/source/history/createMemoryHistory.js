import { createPath } from './PathUtils.js';
import { createLocation } from './LocationUtils.js';
import createTransitionManager from './createTransitionManager.js';
import warning from './warning.js';

function clamp(n, lowerBound, upperBound) { // 区间限定函数
  return Math.min(Math.max(n, lowerBound), upperBound);
}

/**
 * Creates a history object that stores locations in memory.
 */
function createMemoryHistory(props = {}) {
  const {
    getUserConfirmation, //  过渡确认函数
    initialEntries = ['/'], // 初始的模拟历史记录栈(结构为数组)
    initialIndex = 0, // 历史记录的默认索引位置
    keyLength = 6 // key长度
  } = props;

  const transitionManager = createTransitionManager();

  function setState(nextState) { // 发起过渡——更新location、action、index以及entries然后通知监听器执行
    Object.assign(history, nextState);
    history.length = history.entries.length; // 同步history和模拟历史记录的length
    transitionManager.notifyListeners(history.location, history.action);
  }

  function createKey() { // key生成器
    return Math.random()
      .toString(36)
      .substr(2, keyLength);
  }

  const index = clamp(initialIndex, 0, initialEntries.length - 1); // 得到合法的模拟历史记录索引值
  const entries = initialEntries.map(entry => // 从路径数组转化为location数组。entries用于模拟历史记录栈
    typeof entry === 'string'
      ? createLocation(entry, undefined, createKey())
      : createLocation(entry, undefined, entry.key || createKey())
  );

  // Public interface

  const createHref = createPath;

  function push(path, state) {
    warning( // 传入了state且path为location对象则会发出警告
      !(
        typeof path === 'object' &&
        path.state !== undefined &&
        state !== undefined
      ),
      'You should avoid providing a 2nd state argument to push when the 1st ' +
        'argument is a location-like object that already has state; it is ignored'
    );

    const action = 'PUSH';
    const location = createLocation(path, state, createKey(), history.location);

    transitionManager.confirmTransitionTo(
      location,
      action,
      getUserConfirmation,
      ok => {
        if (!ok) return; // 如果拒绝则直接退出

        const prevIndex = history.index; // 获取过渡前的history.index
        const nextIndex = prevIndex + 1; // history下一个索引等于旧的加一

        const nextEntries = history.entries.slice(0); // 浅拷贝旧的entries
        if (nextEntries.length > nextIndex) {
          nextEntries.splice( // 模拟浏览器会话历史管理方式——push时直接将导航前所在历史记录项之后的全部清空，然后在末尾添加新的历史记录项
            nextIndex,
            nextEntries.length - nextIndex,
            location
          );
        } else {
          nextEntries.push(location); // 否则直接添加在末尾即可
        }

        setState({ // 发起过渡
          action,
          location,
          index: nextIndex,
          entries: nextEntries
        });
      }
    );
  }

  function replace(path, state) {
    warning( // 传入了state且path为location对象则会发出警告
      !(
        typeof path === 'object' &&
        path.state !== undefined &&
        state !== undefined
      ),
      'You should avoid providing a 2nd state argument to replace when the 1st ' +
        'argument is a location-like object that already has state; it is ignored'
    );

    const action = 'REPLACE';
    const location = createLocation(path, state, createKey(), history.location);

    transitionManager.confirmTransitionTo(
      location,
      action,
      getUserConfirmation,
      ok => {
        if (!ok) return; // 如果拒绝则直接退出

        history.entries[history.index] = location; // 直接替换即可

        setState({ action, location }); // 发起过渡，且不需要重置index和entries
      }
    );
  }

  function go(n) {
    const nextIndex = clamp(history.index + n, 0, history.entries.length - 1); // 获取合法的跳转索引

    const action = 'POP';
    const location = history.entries[nextIndex];

    transitionManager.confirmTransitionTo(
      location,
      action,
      getUserConfirmation,
      ok => {
        if (ok) { // 用户确认则发起过渡。除了action和location外只需要更新index
          setState({
            action,
            location,
            index: nextIndex
          });
        } else {
          // Mimic the behavior of DOM histories by
          // causing a render after a cancelled POP.
          setState(); // 如果拒绝则只通知监听器执行
        }
      }
    );
  }

  function goBack() { // 后退一步
    go(-1);
  }

  function goForward() { // 前进一步
    go(1);
  }

  function canGo(n) { // 判断n是否为合法跳转步数
    const nextIndex = history.index + n;
    return nextIndex >= 0 && nextIndex < history.entries.length;
  }

  function block(prompt = false) { // 设置提示信息
    return transitionManager.setPrompt(prompt); // 返回清理回调
  }

  function listen(listener) { // 注册监听器
    return transitionManager.appendListener(listener); // 返回清理回调
  }

  const history = { // 利用上面的函数和局部变量构造一个history对象
    length: entries.length,
    action: 'POP',
    location: entries[index],
    index,
    entries,
    createHref,
    push,
    replace,
    go,
    goBack,
    goForward,
    canGo,
    block,
    listen
  };

  return history;
}

export default createMemoryHistory;
