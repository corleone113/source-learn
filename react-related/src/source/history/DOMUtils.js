export const canUseDOM = !!(
  typeof window !== 'undefined' &&
  window.document &&
  window.document.createElement
);

export function getConfirmation(message, callback) { // 默认的过渡前确认函数
  callback(window.confirm(message)); // eslint-disable-line no-alert
}

/**
 * Returns true if the HTML5 history API is supported. Taken from Modernizr.
 *
 * https://github.com/Modernizr/Modernizr/blob/master/LICENSE
 * https://github.com/Modernizr/Modernizr/blob/master/feature-detects/history.js
 * changed to avoid false negatives for Windows Phones: https://github.com/reactjs/react-router/issues/586
 */
export function supportsHistory() { // 判断是否支持history.pushState以及history.replaceState
  const ua = window.navigator.userAgent;

  if ( // 2.0/4.0安卓下的移动端safari不支持pushState，replaceState
    (ua.indexOf('Android 2.') !== -1 || ua.indexOf('Android 4.0') !== -1) &&
    ua.indexOf('Mobile Safari') !== -1 &&
    ua.indexOf('Chrome') === -1 &&
    ua.indexOf('Windows Phone') === -1
  )
    return false;

  return window.history && 'pushState' in window.history; // 最后稳妥起见再直接取直进行判断
}

/**
 * Returns true if browser fires popstate on hash change.
 * IE10 and IE11 do not.
 */
export function supportsPopStateOnHashChange() { // 判断hashchange是否触发popstate
  return window.navigator.userAgent.indexOf('Trident') === -1; // IE不支持hashchange触发popstate
}

/**
 * Returns false if using go(n) with hash history causes a full page reload.
 */
export function supportsGoWithoutReloadUsingHash() { // 判断使用history.go跳转时是否会重新加载页面
  return window.navigator.userAgent.indexOf('Firefox') === -1; // Firefox会出现这种情况
}

/**
 * Returns true if a given popstate event is an extraneous WebKit event.
 * Accounts for the fact that Chrome on iOS fires real popstate events
 * containing undefined state when pressing the back button.
 */
export function isExtraneousPopstateEvent(event) { // 判断后退时是否会产生无效的state——ios上Chrome的行为
  return event.state === undefined && navigator.userAgent.indexOf('CriOS') === -1;
}
