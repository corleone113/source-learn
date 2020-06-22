/* @flow */

export function assert (condition: any, message: string) {
  if (!condition) {
    throw new Error(`[vue-router] ${message}`)
  }
}

export function warn (condition: any, message: string) { // 条件(condition)不满足时发出警告
  if (process.env.NODE_ENV !== 'production' && !condition) {
    typeof console !== 'undefined' && console.warn(`[vue-router] ${message}`)
  }
}

export function isError (err: any): boolean { // 判断是否为Error实例
  return Object.prototype.toString.call(err).indexOf('Error') > -1
}

export function isRouterError (err: any, errorType: ?string): boolean { // 判断err是否为RouterError
  return isError(err) && err._isRouter && (errorType == null || err.type === errorType)
}
