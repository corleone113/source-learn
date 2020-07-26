import resolvePathname from 'resolve-pathname';
import valueEqual from 'value-equal';

import { parsePath } from './PathUtils.js';

export function createLocation(path, state, key, currentLocation) {
  let location;
  if (typeof path === 'string') { // 如果path为字符串则通过parsePath解析得到的对象初始化location
    // Two-arg form: push(path, state)
    location = parsePath(path); // 包含pathname、search、hash等属性
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
    location.pathname = decodeURI(location.pathname); // 使用decodeURI对路径部分进行解码
  } catch (e) {
    if (e instanceof URIError) { // 解码失败且错误类型为URIError则修改描述信息再抛出
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

  if (currentLocation) { // 导航前的location对象——在调用push/replace进行导航时，currentLocation总是会提供，所以导航时基于path(传入push/replace的第一个参数，表示目标位置)创建的location的pathname总是绝对路径，因此Route组件的path必须是'/'开头，否则无法匹配成功。
    // Resolve incomplete/relative pathname relative to current location.
    if (!location.pathname) { // pathname无效则设置为导航前的pathname
      location.pathname = currentLocation.pathname;
    } else if (location.pathname.charAt(0) !== '/') { // 如果pathname是相对路径
      location.pathname = resolvePathname( // 和导航前pathname拼接为绝对路径——resolvePathname内部总是替换模式，即将第二个路径最后一个'/'后面的内容替换为第一个路径。且resolvePathname总是返回绝对路径
        location.pathname,
        currentLocation.pathname
      );
    }
  } else { // pathname无效且没有传入导航前的location对象则赋值为'/'
    // When there is no prior location and pathname is empty, set it to /
    if (!location.pathname) {
      location.pathname = '/';
    }
  }

  return location;
}

export function locationsAreEqual(a, b) { // 判断两个location是否相同。
  return (
    a.pathname === b.pathname &&
    a.search === b.search &&
    a.hash === b.hash &&
    a.key === b.key &&
    valueEqual(a.state, b.state)
  );
}
