import { createLocation } from './LocationUtils.js';
import {
  addLeadingSlash,
  stripLeadingSlash,
  stripTrailingSlash,
  hasBasename,
  stripBasename,
  createPath
} from './PathUtils.js';
import createTransitionManager from './createTransitionManager.js';
import {
  canUseDOM,
  getConfirmation,
  supportsGoWithoutReloadUsingHash
} from './DOMUtils.js';
import invariant from './invariant.js';
import warning from './warning.js';

const HashChangeEvent = 'hashchange';

const HashPathCoders = { // 定义hash路径的类型
  hashbang: { // ajax crawlable类型的hash路径——以'!/'开头，比如：'#!/some/path'
    encodePath: path => // 转换为这种类型
      path.charAt(0) === '!' ? path : '!/' + stripLeadingSlash(path),
    decodePath: path => (path.charAt(0) === '!' ? path.substr(1) : path) // 还原
  },
  noslash: { // 非斜杠开头的hash路径，比如：'#some/path'
    encodePath: stripLeadingSlash, // 转换为这种类型
    decodePath: addLeadingSlash // 还原
  },
  slash: { // 斜杠开头的hash路径，比如：'#/some/path'。这是默认的hash路径类型
    encodePath: addLeadingSlash, // 转换为这种类型
    decodePath: addLeadingSlash // 还原
  }
};

function stripHash(url) { // 返回URL中'#'之前的部分，不包含'#'则返回整个URL
  const hashIndex = url.indexOf('#');
  return hashIndex === -1 ? url : url.slice(0, hashIndex);
}

function getHashPath() { // 获取当前hash路径(去掉'#'的剩余部分)
  // We can't use window.location.hash here because it's not
  // consistent across browsers - Firefox will pre-decode it!
  const href = window.location.href;
  const hashIndex = href.indexOf('#');
  return hashIndex === -1 ? '' : href.substring(hashIndex + 1);
}

function pushHashPath(path) { // 变更hash路径
  window.location.hash = path;
}

function replaceHashPath(path) { // 将当前URL路径替换hash路径
  window.location.replace(stripHash(window.location.href) + '#' + path);
}

function createHashHistory(props = {}) {
  invariant(canUseDOM, 'Hash history needs a DOM'); // 非浏览器环境(包括webview)下使用则报错

  const globalHistory = window.history;
  const canGoWithoutReload = supportsGoWithoutReloadUsingHash(); // 判断使用history.go跳转时是否会重新加载页面

  const { getUserConfirmation = getConfirmation, hashType = 'slash' } = props; // 通过props初始化过渡前处理函数以及hash路径类型
  const basename = props.basename
    ? stripTrailingSlash(addLeadingSlash(props.basename)) // 传入了basename则初始化为该值并添加首'/'和删除末尾'/'
    : ''; // 没有传入basename则初始化为''

  const { encodePath, decodePath } = HashPathCoders[hashType]; // 相应hash路径类型的转换函数、反转函数

  function getDOMLocation() { //将当前URL转化为location对象
    let path = decodePath(getHashPath()); // 获取当前fullpath

    warning(
      !basename || hasBasename(path, basename), // 当前基路径(basename)不为空字串且URL路径中不包含基路径则发出警告
      'You are attempting to use a basename on a page whose URL path does not begin ' +
        'with the basename. Expected path "' +
        path +
        '" to begin with "' +
        basename +
        '".'
    );

    if (basename) path = stripBasename(path, basename); // 如果基路径不为空字串，则去掉fullpath中的基路径

    return createLocation(path); // 创建location
  }

  const transitionManager = createTransitionManager();

  function setState(nextState) { // 发起过渡——更新location和action然后通知监听器执行
    Object.assign(history, nextState);
    history.length = globalHistory.length; // 同步history.length(历史记录项数量)
    transitionManager.notifyListeners(history.location, history.action);
  }

  let forceNextPop = false; // 是否强制触发过渡
  let ignorePath = null;

  function locationsAreEqual(a, b) { // 判断两个位置对应的fullpath(path+search+hash)是否相同
    return (
      a.pathname === b.pathname && a.search === b.search && a.hash === b.hash
    );
  }

  function handleHashChange() {
    const path = getHashPath(); // 获取当前哈希路径
    const encodedPath = encodePath(path); // 尝试转换为相应的路径类型

    if (path !== encodedPath) { // 确保哈希路径的类型和规定的一致
      // Ensure we always have a properly-encoded hash.
      replaceHashPath(encodedPath);
    } else {
      const location = getDOMLocation(); // 获取当前URL的location对象
      const prevLocation = history.location;
      // 如果不需要强制过渡且当前fullpath未发生变化则不做处理
      if (!forceNextPop && locationsAreEqual(prevLocation, location)) return; // A hashchange doesn't always == location change.
      // 当前fullpath是被忽略的则也不做处理
      if (ignorePath === createPath(location)) return; // Ignore this change; we already setState in push/replace.

      ignorePath = null; // 重置

      handlePop(location);
    }
  }

  function handlePop(location) {
    if (forceNextPop) { // 需要强制过渡
      forceNextPop = false;
      setState(); // 强制过渡时不更新action、location
    } else {
      const action = 'POP';

      transitionManager.confirmTransitionTo(
        location,
        action,
        getUserConfirmation,
        ok => {
          // debugger
          if (ok) { // 确认后发起过渡
            setState({ action, location });
          } else { // 否则回滚
            revertPop(location);
          }
        }
      );
    }
  }

  function revertPop(fromLocation) { // 回滚到之前的位置。一些情况存在BUG——比如当前位于window.history最后一个历史记录项，直接修改hash(链接、location.hash、地址栏输入)触发hashchange时会新增历史记录项，然后导致allPaths不同步,因此计算出的delta为错误的，从而go跳转失败而不会触发hashchange，进而导致下次hashchange事件被忽略。
    const toLocation = history.location; // 过渡前URL的location

    // TODO: We could probably make this more reliable by
    // keeping a list of paths we've seen in sessionStorage.
    // Instead, we just default to 0 for paths we don't know.

    let toIndex = allPaths.lastIndexOf(createPath(toLocation)); // 过渡前URLfullpath最近一次缓存的索引

    if (toIndex === -1) toIndex = 0; // 没缓存过则置为0

    let fromIndex = allPaths.lastIndexOf(createPath(fromLocation)); // 过渡后URLfullpath最近一次缓存的索引

    if (fromIndex === -1) fromIndex = 0;

    const delta = toIndex - fromIndex; // 计算跳转步数

    if (delta) {
      forceNextPop = true; // 会触发hashchange事件(调用handleHashChange函数)，因为是回滚所以过渡时不需要更新location和action
      go(delta); // 根据跳转步数使用history.go进行跳转
    }
  }

  // Ensure the hash is encoded properly before doing anything else.
  const path = getHashPath(); // 初始化当前哈希路径
  const encodedPath = encodePath(path); // 初始化为指定哈希路径类型的path

  if (path !== encodedPath) replaceHashPath(encodedPath);

  const initialLocation = getDOMLocation(); // 初次加载时URL的location对象
  let allPaths = [createPath(initialLocation)]; // 缓存fullpath字符串的数组

  // Public interface

  function createHref(location) { // 根据location解析出URL字符串
    const baseTag = document.querySelector('base');
    let href = '';
    if (baseTag && baseTag.getAttribute('href')) { // 如果存在带有href attribute的base元素则获取当前URL中#之前的部分作为前置部分
      href = stripHash(window.location.href);
    }
    return href + '#' + encodePath(basename + createPath(location));
  }

  function push(path, state) {
    warning(
      state === undefined, // 如果传入state则发出警告——哈希history不能添加state，会被忽略
      'Hash history cannot push state; it is ignored'
    );

    const action = 'PUSH';
    const location = createLocation( // 基于目标路径创建一个location
      path,
      undefined,
      undefined,
      history.location
    );

    transitionManager.confirmTransitionTo(
      location,
      action,
      getUserConfirmation,
      ok => {
        if (!ok) return; // 如果拒绝则直接退出

        const path = createPath(location);
        const encodedPath = encodePath(basename + path);
        const hashChanged = getHashPath() !== encodedPath; // 判断fullpath是否发生变化

        if (hashChanged) { // fullpath发生过变化，此时会触发hashchange事件
          // We cannot tell if a hashchange was caused by a PUSH, so we'd
          // rather setState here and ignore the hashchange. The caveat here
          // is that other hash histories in the page will consider it a POP.
          ignorePath = path; // 该确认回调执行之前可能又触发过hashchange事件(重复修改hash只会触发一次hashchange)，因此依赖push触发hashchange事件来发起过渡可能导致push产生的location和action被覆盖，所以这里通过ignorePath忽略hashchange，而直接发起过渡(调用setState)。
          pushHashPath(encodedPath); // 变更hash路径

          const prevIndex = allPaths.lastIndexOf(createPath(history.location)); // 过渡前fullpath最近一次缓存的索引
          const nextPaths = allPaths.slice(0, prevIndex + 1); // 拷贝该索引之前的元素

          nextPaths.push(path); // 添加过渡后的fullpath；
          allPaths = nextPaths; // 重置缓存数组以保证push的fullpath总是最后一个缓存——使用和浏览器会话历史栈一样的管理方式

          setState({ action, location }); // 直接发起过渡
        } else {
          warning( // 重复的push会发出警告
            false,
            'Hash history cannot PUSH the same path; a new entry will not be added to the history stack'
          );

          setState(); // 但还是会发起过渡
        }
      }
    );
  }

  function replace(path, state) {
    warning(
      state === undefined, // 如果传入state则发出警告——哈希history不能添加state，会被忽略
      'Hash history cannot replace state; it is ignored'
    );

    const action = 'REPLACE';
    const location = createLocation(
      path,
      undefined,
      undefined,
      history.location
    );

    transitionManager.confirmTransitionTo(
      location,
      action,
      getUserConfirmation,
      ok => {
        if (!ok) return; // 如果拒绝则直接退出

        const path = createPath(location);
        const encodedPath = encodePath(basename + path);
        const hashChanged = getHashPath() !== encodedPath;

        if (hashChanged) {
          // We cannot tell if a hashchange was caused by a REPLACE, so we'd
          // rather setState here and ignore the hashchange. The caveat here
          // is that other hash histories in the page will consider it a POP.
          ignorePath = path; // 和上面push中一样原因
          replaceHashPath(encodedPath); // 替换当前哈希路径
        }

        const prevIndex = allPaths.indexOf(createPath(history.location)); // 获取过渡前fullpath最近一次缓存的索引

        if (prevIndex !== -1) allPaths[prevIndex] = path; // 存在缓存则进行替换

        setState({ action, location }); // 发起过渡
      }
    );
  }

  function go(n) {
    warning(
      canGoWithoutReload, // 如果调用go会导致重载则发出警告
      'Hash history go(n) causes a full page reload in this browser'
    );

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

    if (listenerCount === 1 && delta === 1) { // 引用计数器为1时才添加监听器，避免重复添加
      window.addEventListener(HashChangeEvent, handleHashChange);
    } else if (listenerCount === 0) { // 引用计数器为0时则移除监听器
      window.removeEventListener(HashChangeEvent, handleHashChange);
    }
  }

  let isBlocked = false;

  function block(prompt = false) { // 设置提示信息
    const unblock = transitionManager.setPrompt(prompt);

    if (!isBlocked) { // block没有调用过则添加hashchange监听器
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

  function listen(listener) { // 注册过渡监听器和hashchange事件监听器
    const unlisten = transitionManager.appendListener(listener);
    checkDOMListeners(1);

    return () => { // 返回清理回调
      checkDOMListeners(-1);
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

export default createHashHistory;
