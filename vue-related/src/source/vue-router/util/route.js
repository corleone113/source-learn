/* @flow */

import type VueRouter from '../index'
import { stringifyQuery } from './query'

const trailingSlashRE = /\/?$/

export function createRoute ( // 创建路由
  record: ?RouteRecord, // 可为null/undefined
  location: Location,
  redirectedFrom?: ?Location,
  router?: VueRouter
): Route {
  const stringifyQuery = router && router.options.stringifyQuery // 查询参数对象转查询字符串的函数

  let query: any = location.query || {} // 查询参数对象
  try {
    query = clone(query) // 深拷贝。
  } catch (e) {console.error(e)}

  const route: Route = { // record主要用于元数据和matched数组的初始化。
    name: location.name || (record && record.name),
    meta: (record && record.meta) || {},
    path: location.path || '/',
    hash: location.hash || '',
    query,
    params: location.params || {},
    fullPath: getFullPath(location, stringifyQuery), // 得到完整的URL路径——path+quer+hash
    matched: record ? formatMatch(record) : [] // 为空数组表示匹配失败，此时没有路由组件渲染
  }
  if (redirectedFrom) { // 如果传入跳转来源location的话则获取跳转来源URL的完整路径然后保存为redirectedFrom属性
    route.redirectedFrom = getFullPath(redirectedFrom, stringifyQuery)
  }
  return Object.freeze(route) // 冻结route对象，浅冻结
}

function clone (value) { // 深拷贝 不过没有考虑循环引用的情况。
  if (Array.isArray(value)) {
    return value.map(clone)
  } else if (value && typeof value === 'object') {
    const res = {}
    for (const key in value) {
      res[key] = clone(value[key])
    }
    return res
  } else {
    return value
  }
}

// the starting route that represents the initial state
export const START = createRoute(null, {
  path: '/'
})

function formatMatch (record: ?RouteRecord): Array<RouteRecord> { // 将单个路由记录转化为依照父子关系存放的路由记录数组
  const res = []
  while (record) {
    res.unshift(record)
    record = record.parent
  }
  return res
}

function getFullPath ( // 获取完整的URL路径
  { path, query = {}, hash = '' },
  _stringifyQuery
): string {
  const stringify = _stringifyQuery || stringifyQuery
  return (path || '/') + stringify(query) + hash
}

export function isSameRoute (a: Route, b: ?Route): boolean { // 判断是否是相同的路由
  if (b === START) { // 根路径的路由是单例的
    return a === b
  } else if (!b) { // b为null或undefind直接返回false
    return false
  } else if (a.path && b.path) { // 存在path则基于path进行判断，哈希片段和查询参数也要一致
    return (
      a.path.replace(trailingSlashRE, '') === b.path.replace(trailingSlashRE, '') &&
      a.hash === b.hash &&
      isObjectEqual(a.query, b.query)
    )
  } else if (a.name && b.name) { // 没有path属性则通过name和params来进行比较，哈希和查询参数还是要一致
    return (
      a.name === b.name &&
      a.hash === b.hash &&
      isObjectEqual(a.query, b.query) &&
      isObjectEqual(a.params, b.params)
    )
  } else { // 其它基本类型的值也返回false
    return false
  }
}

function isObjectEqual (a = {}, b = {}): boolean { // 对象深比较
  // handle null value #1566
  if (!a || !b) return a === b
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) {
    return false
  }
  return aKeys.every(key => {
    const aVal = a[key]
    const bVal = b[key]
    // check nested equality
    if (typeof aVal === 'object' && typeof bVal === 'object') {
      return isObjectEqual(aVal, bVal) // 如果属性值为对象，递归调用此方法进行比较。
    }
    return String(aVal) === String(bVal)
  })
}

export function isIncludedRoute (current: Route, target: Route): boolean { // 判断current路由是否包含target路由
  return (
    current.path.replace(trailingSlashRE, '/').indexOf(
      target.path.replace(trailingSlashRE, '/')
    ) === 0 &&
    (!target.hash || current.hash === target.hash) &&
    queryIncludes(current.query, target.query)
  )
}

function queryIncludes (current: Dictionary<string>, target: Dictionary<string>): boolean { // 判断查询参数对象是否相等，浅比较
  for (const key in target) {
    if (!(key in current)) {
      return false
    }
  }
  return true
}
