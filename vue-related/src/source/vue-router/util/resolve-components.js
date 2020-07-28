/* @flow */

import { _Vue } from '../install'
import { warn, isError } from './warn'

export function resolveAsyncComponents (matched: Array<RouteRecord>): Function { // 返回用于解析路由记录的异步组件的回调
  return (to, from, next) => { // 将作为守卫在导航时被执行，用于解析路由记录中的异步组件——有则进行解析处理，否则跳过
    let hasAsync = false
    let pending = 0
    let error = null

    flatMapComponents(matched, (def, _, match, key) => {
      // if it's a function and doesn't have cid attached,
      // assume it's an async component resolve function.
      // we are not using Vue's default async resolving mechanism because
      // we want to halt the navigation until the incoming component has been
      // resolved.
      if (typeof def === 'function' && def.cid === undefined) { // 是函数且没有cid属性就判定为异步组件
        hasAsync = true
        pending++ // 标识处于解析状态的异步组件的数量

        const resolve = once(resolvedDef => { // 解析成功的回调，且只能执行一次
          if (isESModule(resolvedDef)) { // 解析结果为ES模块则取其default作为结果
            resolvedDef = resolvedDef.default
          }
          // save resolved on async factory in case it's used elsewhere
          def.resolved = typeof resolvedDef === 'function' // 将解析结果缓存到def.resolved上，方便后续复用
            ? resolvedDef
            : _Vue.extend(resolvedDef)
          match.components[key] = resolvedDef // 用解析结果替换原异步组件
          pending-- // 解析完成则减一
          if (pending <= 0) { // pending为0表示全部解析完，则调用next进行下一步
            next()
          }
        })

        const reject = once(reason => { // 解析失败的回调，且只能执行一次
          const msg = `Failed to resolve async component ${key}: ${reason}`
          process.env.NODE_ENV !== 'production' && warn(false, msg)
          if (!error) {
            error = isError(reason)
              ? reason
              : new Error(msg)
            next(error) // 解析失败，调用next以中断导航
          }
        })

        let res
        try {
          res = def(resolve, reject) // 如何是接收resolve/reject的回调则不会有返回值，而直接在回调中通过resolve/reject处理解析结果，否则返回一个Promise或对象，详情参考官方文档异步组件部分。
        } catch (e) {
          reject(e)
        }
        if (res) { // 如果res是promise，那么调用resolve和reject来进行处理
          if (typeof res.then === 'function') {
            res.then(resolve, reject)
          } else { // 如果res.component是promise，那么调用resolve和reject来进行处理
            // new syntax in Vue 2.3
            const comp = res.component
            if (comp && typeof comp.then === 'function') {
              comp.then(resolve, reject)
            }
          }
        }
      }
    })

    if (!hasAsync) next() // 不存在异步组件则调用next继续导航
  }
}

export function flatMapComponents ( // 遍历每个路由记录的各个组件并调用传入的回调，返回执行结果数组。
  matched: Array<RouteRecord>,
  fn: Function
): Array<?Function> {
  return flatten(matched.map(m => {
    return Object.keys(m.components).map(key => fn(
      m.components[key],
      m.instances[key],
      m, key
    ))
  }))
}

export function flatten (arr: Array<any>): Array<any> { // 只展开一层
  return Array.prototype.concat.apply([], arr)
}

const hasSymbol =
  typeof Symbol === 'function' &&
  typeof Symbol.toStringTag === 'symbol'

function isESModule (obj) { // 判断是否是ES模块
  return obj.__esModule || (hasSymbol && obj[Symbol.toStringTag] === 'Module')
}

// in Webpack 2, require.ensure now also returns a Promise
// so the resolve/reject functions may get called an extra time
// if the user uses an arrow function shorthand that happens to
// return that Promise.
function once (fn) { // 让fn只能调用一次
  let called = false
  return function (...args) {
    if (called) return
    called = true
    return fn.apply(this, args)
  }
}
