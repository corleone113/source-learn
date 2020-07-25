/* @flow */

import { warn } from './warn'
import Regexp from 'path-to-regexp'

// $flow-disable-line
const regexpCompileCache: {
  [key: string]: Function
} = Object.create(null)

export function fillParams (
  path: string,
  params: ?Object,
  routeMsg: string
): string {
  params = params || {}
  try {
    // pathToRegexp.compile通过给定path返回一个将params对象转化为和path匹配的URL的函数
    const filler =
      regexpCompileCache[path] || // 有缓存则使用缓存
      (regexpCompileCache[path] = Regexp.compile(path)) // 无缓存则创建新的，然后缓存起来

    // Fix #2505 resolving asterisk routes { name: 'not-found', params: { pathMatch: '/not-found' }}
    // and fix #3106 so that you can work with location descriptor object having params.pathMatch equal to empty string
    if (typeof params.pathMatch === 'string') params[0] = params.pathMatch // 将params中的pathMatch参数还原为匿名路径参数('(.*)')，关于匿名路径参数参考：https://github.com/pillarjs/path-to-regexp/tree/1.x#unnamed-parameters

    return filler(params, { pretty: true }) // pretty为true表示不对路径参数的值进行编译(通过encodeURIComponent)
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') { // 捕获错误但params.pathMatch为字符串时不发出警告
      // Fix #3072 no warn if `pathMatch` is string
      warn(typeof params.pathMatch === 'string', `missing param for ${routeMsg}: ${e.message}`)
    }
    return ''
  } finally {
    // delete the 0 if it was added
    delete params[0] // 如果添加过匿名路径参数则最后将其删除
  }
}
