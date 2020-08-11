import { createLocation } from './LocationUtils.js';
import {
  addLeadingSlash,
  stripTrailingSlash,
  hasBasename,
  stripBasename,
  createPath
} from './PathUtils.js';
import createTransitionManager from './createTransitionManager.js';
import {
  canUseDOM,
  getConfirmation,
  supportsHistory,
  supportsPopStateOnHashChange,
  isExtraneousPopstateEvent
} from './DOMUtils.js';
import invariant from './invariant.js';
import warning from './warning.js';

const PopStateEvent = 'popstate';
const HashChangeEvent = 'hashchange';

function getHistoryState() { // 获取window.history中保存的状态
  try {
    return window.history.state || {}; // 没有则返回空对象
  } catch (e) {
    // IE 11 sometimes throws when accessing window.history.state
    // See https://github.com/ReactTraining/history/pull/289
    return {};
  }
}

/**
 * Creates a history object that uses the HTML5 history API including
 * pushState, replaceState, and the popstate event.
 */
function createBrowserHistory(props = {}) {
  invariant(canUseDOM, 'Browser history needs a DOM'); // 非浏览器环境(包括webview)下使用则报错

  const globalHistory = window.history;
  const canUseHistory = supportsHistory(); // 是否支持history.pushState以及history.replaceState
  const needsHashChangeListener = !supportsPopStateOnHashChange(); // hashchange触发时不会同时触发popstate

  const {
    forceRefresh = false,
    getUserConfirmation = getConfirmation,
    keyLength = 6
  } = props; // 获取配置参数——来自Router实例的props
  const basename = props.basename
    ? stripTrailingSlash(addLeadingSlash(props.basename)) // 传入了basename则初始化为该值并添加首'/'和删除末尾'/'
    : ''; // 没有传入basename则初始化为''

  function getDOMLocation(historyState) { //根据指定历史记录项的state创建location(目标位置)
    const { key, state } = historyState || {}; // 根据history获取key和state
    const { pathname, search, hash } = window.location; // 从window.location获取路径、查询字符串、哈希片段

    let path = pathname + search + hash; // 得到fullpath

    warning(
      !basename || hasBasename(path, basename), // 存在基路径的情况下fullpath中不包含基路径则发出警告
      'You are attempting to use a basename on a page whose URL path does not begin ' +
        'with the basename. Expected path "' +
        path +
        '" to begin with "' +
        basename +
        '".'
    );

    if (basename) path = stripBasename(path, basename); // 去掉fullpath中的基路径

    return createLocation(path, state, key); // BrowserHistory的location具有state和key属性，这是HashHistory没有的特性
  }

  function createKey() { // 生成state key
    return Math.random()
      .toString(36)
      .substr(2, keyLength);
  }

  const transitionManager = createTransitionManager();

  function setState(nextState) { // 更新location和action然后通知监听器执行
    Object.assign(history, nextState);
    history.length = globalHistory.length; // 同步history.length(历史记录项数量)
    transitionManager.notifyListeners(history.location, history.action);
  }

  function handlePopState(event) { // popstate监听器
    // Ignore extraneous popstate events in WebKit.
    if (isExtraneousPopstateEvent(event)) return; // 如果后退时会产生无效的state，则直接退出
    handlePop(getDOMLocation(event.state)); // 基于state对应的location来处理popstate事件
  }

  function handleHashChange() { // hashchange监听器
    handlePop(getDOMLocation(getHistoryState())); // 需要从window.history获取state，然后基于对应的location来处理hashchange事件
  }

  let forceNextPop = false; // 是否强制触发导航

  function handlePop(location) {
    if (forceNextPop) { // 需要强制导航
      forceNextPop = false;
      setState(); // 强制导航时不更新action、location
    } else {
      const action = 'POP';
      transitionManager.confirmTransitionTo(
        location,
        action,
        getUserConfirmation,
        ok => {
          if (ok) { // 确认后则更新action和location，然后执行监听回调。
            setState({ action, location });
          } else { // 否则回滚到之前的页面
            revertPop(location);
          }
        }
      );
    }
  }

  function revertPop(fromLocation) { // 回滚到之前的位置。没有HashHistory版本的那个BUG
    const toLocation = history.location;

    // TODO: We could probably make this more reliable by
    // keeping a list of keys we've seen in sessionStorage.
    // Instead, we just default to 0 for keys we don't know.

    let toIndex = allKeys.indexOf(toLocation.key); // 导航前location.key最近一次缓存的索引

    if (toIndex === -1) toIndex = 0; // 没缓存过则置为0

    let fromIndex = allKeys.indexOf(fromLocation.key);; // 导航后location.key最近一次缓存的索引

    if (fromIndex === -1) fromIndex = 0;

    const delta = toIndex - fromIndex; // 计算跳转步数

    if (delta) {
      forceNextPop = true; // 下面调用history.go会触发popstate/hashchange事件(调用handlePop/handleHash函数)，而回滚不需要触发导航，所以通过forceNextPop让handleHashChange忽略本次hash变更
      go(delta); // 根据跳转步数使用history.go进行跳转
    }
  }

  const initialLocation = getDOMLocation(getHistoryState()); // 初次加载时URL路径的location对象
  let allKeys = [initialLocation.key]; // 缓存key的数组

  // Public interface

  function createHref(location) { // 根据location解析出fullpath然后拼接出绝对URL路径
    return basename + createPath(location);
  }

  function push(path, state) {
    warning( // 传入了state但path为对象(location)且含有state属性则会发出警告
      !(
        typeof path === 'object' &&
        path.state !== undefined &&
        state !== undefined
      ),
      'You should avoid providing a 2nd state argument to push when the 1st ' +
        'argument is a location-like object that already has state; it is ignored'
    );

    const action = 'PUSH';
    const location = createLocation(path, state, createKey(), history.location); // 基于目标位置创建一个location

    transitionManager.confirmTransitionTo(
      location,
      action,
      getUserConfirmation,
      ok => {
        if (!ok) return; // 如果拒绝则直接退出

        const href = createHref(location);
        const { key, state } = location;

        if (canUseHistory) {
          globalHistory.pushState({ key, state }, null, href); // 如果支持pushState则添加一个历史记录项

          if (forceRefresh) { // 如果规定导航结束时强制刷新则修改URL触发刷新
            window.location.href = href;
          } else {
            const prevIndex = allKeys.indexOf(history.location.key); // 导航前location.key最近一次缓存的索引
            const nextKeys = allKeys.slice(0, prevIndex + 1); // 拷贝该索引及其前面的元素

            nextKeys.push(location.key); // 添加导航后的location.key；
            allKeys = nextKeys; // 重置缓存数组以保证push的location.key总是最后一个缓存——使用和浏览器会话历史栈一样的管理方式

            setState({ action, location });
          }
        } else {
          warning( // 不支持pushState且传入了有效的state时发出警告
            state === undefined,
            'Browser history cannot push state in browsers that do not support HTML5 history'
          );

          window.location.href = href; // 直接变更URL——修改href会新增历史记录项
        }
      }
    );
  }

  function replace(path, state) {
    warning( // 传入了state且path为对象(location)但含有state属性则会发出警告
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
        if (!ok) return;

        const href = createHref(location);
        const { key, state } = location;

        if (canUseHistory) {
          globalHistory.replaceState({ key, state }, null, href); // 如果支持replaceState则替换当前历史记录项

          if (forceRefresh) {
            window.location.replace(href); // 如果规定导航结束时强制刷新则修改URL触发刷新
          } else {
            const prevIndex = allKeys.indexOf(history.location.key); // 找到导航前location.key第一个缓存索引

            if (prevIndex !== -1) allKeys[prevIndex] = location.key; // 只修改对应索引的key

            setState({ action, location });
          }
        } else {
          warning( // 不支持pushState且传入了有效的state时发出警告
            state === undefined,
            'Browser history cannot replace state in browsers that do not support HTML5 history'
          );

          window.location.replace(href); // 通过replace变更URL——不会新增历史记录项
        }
      }
    );
  }

  function go(n) {
    globalHistory.go(n); // 调用history.go
  }

  function goBack() { // 后退一步
    go(-1);
  }

  function goForward() { // 前进一步
    go(1);
  }

  let listenerCount = 0;

  function checkDOMListeners(delta) { // 根据引用计数器来添加/移除hashchange监听器
    listenerCount += delta;

    if (listenerCount === 1 && delta === 1) { // 引用计数器为1时才添加popstate监听器，避免重复添加
      window.addEventListener(PopStateEvent, handlePopState);

      if (needsHashChangeListener) // hashchange不会触发popstate则添加hashchange事件监听器，保证平台特性的一致性——大部分浏览器触发hashchange时也会触发popstate
        window.addEventListener(HashChangeEvent, handleHashChange);
    } else if (listenerCount === 0) { // 引用计数器为0时移除popstate监听器
      window.removeEventListener(PopStateEvent, handlePopState);

      if (needsHashChangeListener) // 添加hashchange监听器则进行移除
        window.removeEventListener(HashChangeEvent, handleHashChange);
    }
  }

  let isBlocked = false;

  function block(prompt = false) { // 设置提示信息
    const unblock = transitionManager.setPrompt(prompt);

    if (!isBlocked) { // 还未设置过提示信息则为window.popstate/hashchange事件(可能含有)绑定监听器
      checkDOMListeners(1);
      isBlocked = true;
    }

    return () => { // 返回清理回调
      if (isBlocked) {
        isBlocked = false;
        checkDOMListeners(-1);
      }

      return unblock();
    };
  }

  function listen(listener) { // 注册导航监听器
    const unlisten = transitionManager.appendListener(listener);
    checkDOMListeners(1); // 尝试添加popstate/hashchange事件监听器

    return () => { // 返回清理回调
      checkDOMListeners(-1); // 尝试清理事件监听器——只要提示信息不为null或还存在导航监听器则无法清理popstate/hashchange事件监听器
      unlisten();
    };
  }

  const history = { // 利用上面的函数和局部变量构造一个history对象
    length: globalHistory.length,
    action: 'POP',
    location: initialLocation,
    createHref,
    push,
    replace,
    go,
    goBack,
    goForward,
    block,
    listen
  };

  return history;
}

export default createBrowserHistory;
