/* @flow */

import { inBrowser } from './dom'
import { saveScrollPosition } from './scroll'
import { genStateKey, setStateKey, getStateKey } from './state-key'
import { extend } from './misc'

export const supportsPushState = // 返回支持的pushState API
  inBrowser &&
  (function () {
    const ua = window.navigator.userAgent

    if ( // 2.0/4.0安卓下的移动端safari不支持pushState，replaceState
      (ua.indexOf('Android 2.') !== -1 || ua.indexOf('Android 4.0') !== -1) &&
      ua.indexOf('Mobile Safari') !== -1 &&
      ua.indexOf('Chrome') === -1 &&
      ua.indexOf('Windows Phone') === -1
    ) {
      return false
    }

    return window.history && typeof window.history.pushState === 'function'
  })()

export function pushState (url?: string, replace?: boolean) {
  saveScrollPosition()
  // try...catch the pushState call to get around Safari
  // DOM Exception 18 where it limits to 100 pushState calls
  const history = window.history
  try {
    if (replace) {
      // preserve existing history state as it could be overriden by the user
      const stateCopy = extend({}, history.state) // 历史记录项state的浅拷贝
      stateCopy.key = getStateKey() // 复用当前的时间戳key
      history.replaceState(stateCopy, '', url)
    } else {
      history.pushState({ key: setStateKey(genStateKey()) }, '', url) // 将地址栏URL路径为url并使用时间戳作为历史记录state的key
    }
  } catch (e) {
    window.location[replace ? 'replace' : 'assign'](url) // 不支持history.pushState和history.replaceState则使用location进行页面跳转
  }
}

export function replaceState (url?: string) { // 将地址栏URL路径改为url并替换历史记录项
  pushState(url, true)
}
