import resolvePathname from 'resolve-pathname';
import valueEqual from 'value-equal';

import { parsePath } from './PathUtils.js';

export function createLocation(path, state, key, currentLocation) {
  let location;
  if (typeof path === 'string') { // 如果path为字符串则通过parsePath解析得到的对象初始化location
    // Two-arg form: push(path, state)
    location = parsePath(path); //
    location.state = state;
  } else { // path为一个对象
    // One-arg form: push(location)
    location = { ...path };

    if (location.pathname === undefined) location.pathname = ''; // path.pathname不存在则初始化为空字串

    if (location.search) { // path.search存在则添加前置'?'
      if (location.search.charAt(0) !== '?')
        location.search = '?' + location.search;
    } else { // 不存在则初始化空字串
      location.search = '';
    }

    if (location.hash) { // path.hash存在则添加前置'#'
      if (location.hash.charAt(0) !== '#') location.hash = '#' + location.hash;
    } else { // 不存在则初始化空字串
      location.hash = '';
    }

    if (state !== undefined && location.state === undefined)
      location.state = state;
  }

  try {
    location.pathname = decodeURI(location.pathname); // 使用decodeURI对路径部分进行编码
  } catch (e) {
    if (e instanceof URIError) { // 编码失败且错误类型为URIError则修改描述信息再抛出
      throw new URIError(
        'Pathname "' +
          location.pathname +
          '" could not be decoded. ' +
          'This is likely caused by an invalid percent-encoding.'
      );
    } else { // 其它错误则直接抛出
      throw e;
    }
  }

  if (key) location.key = key; // path为对象且传入key参数则将其赋给location

  if (currentLocation) { // 过渡前的location对象
    // Resolve incomplete/relative pathname relative to current location.
    if (!location.pathname) { // pathname无效则赋为过渡前的pathname
      location.pathname = currentLocation.pathname;
    } else if (location.pathname.charAt(0) !== '/') { // 如果pathname时相对路径
      location.pathname = resolvePathname( // 则相对于过渡前pathname的绝对路径——最后一个'/'之前的路径被当成目录，支持'.'(当前目录)和'..'(上级目录)
        location.pathname,
        currentLocation.pathname
      );
    }
  } else { // pathname无效且没有传入过渡前的location对象则赋值为'/'
    // When there is no prior location and pathname is empty, set it to /
    if (!location.pathname) {
      location.pathname = '/';
    }
  }

  return location;
}

export function locationsAreEqual(a, b) { // 判断两个location是否相等。
  return (
    a.pathname === b.pathname &&
    a.search === b.search &&
    a.hash === b.hash &&
    a.key === b.key &&
    valueEqual(a.state, b.state)
  );
}
