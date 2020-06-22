/* @flow */

import type VueRouter from './index'
import { resolvePath } from './util/path'
import { assert, warn } from './util/warn'
import { createRoute } from './util/route'
import { fillParams } from './util/params'
import { createRouteMap } from './create-route-map'
import { normalizeLocation } from './util/location'

export type Matcher = {
  match: (raw: RawLocation, current?: Route, redirectedFrom?: Location) => Route;
  addRoutes: (routes: Array<RouteConfig>) => void;
};

export function createMatcher ( // 根据路由配置数组和路由器创建matcher——matcher提供match和addRoutes接口
  routes: Array<RouteConfig>,
  router: VueRouter
): Matcher {
  const { pathList, pathMap, nameMap } = createRouteMap(routes) // pathList是路由path的数组，pathMap是path到路由记录的映射表，nameMap是name到路由记录的映射表

  function addRoutes (routes) { // 添加新的路由配置(数组)
    createRouteMap(routes, pathList, pathMap, nameMap) // 这里相当于更新pathList，pathMap，nameMap
  }

  function match ( // 返回和raw(目标位置)匹配的路由，顺序是：1.基于raw和currentRoute创建一个location；2.基于location查询路由记录；3.找到了就返回一个匹配路由并基于其matched在router-view中重新创建/更新视图，否则返回非匹配路由——matched为空数组，所以不更新router-view视图内容
    raw: RawLocation,
    currentRoute?: Route,
    redirectedFrom?: Location
  ): Route {
    const location = normalizeLocation(raw, currentRoute, false, router) // 根据raw和当前路由生成location
    const { name } = location

    if (name) { // 优先考虑基于name进行匹配，因为这种匹配方式基于键查询映射表，所以性能好一些
      const record = nameMap[name] // 查询路由记录映射表
      if (process.env.NODE_ENV !== 'production') { // location存在name属性，但是路由记录映射表中找不到对应的记录
        warn(record, `Route with name '${name}' does not exist`)
      }
      if (!record) return _createRoute(null, location) // 没有找到记录则表示匹配失败，此时返回只基于location生成的非匹配路由
      const paramNames = record.regex.keys
        .filter(key => !key.optional)
        .map(key => key.name) // 根据pathToRegexp返回的正则的keys属性确定必要的路径参数的名称数组

      if (typeof location.params !== 'object') { // location.params不为对象则赋值为空对象
        location.params = {}
      }

      if (currentRoute && typeof currentRoute.params === 'object') {
        for (const key in currentRoute.params) { // 利用当前路由params对象来填充location.params上缺失的必要路径参数
          if (!(key in location.params) && paramNames.indexOf(key) > -1) {
            location.params[key] = currentRoute.params[key]
          }
        }
      }

      location.path = fillParams(record.path, location.params, `named route "${name}"`) // 基于params解析出符合path规则的URL路径，然后保存到location.path
      return _createRoute(record, location, redirectedFrom) // 返回匹配路由
    } else if (location.path) { // 通过path匹配是次级选择
      location.params = {}
      for (let i = 0; i < pathList.length; i++) { // 遍历pathList过程中会多次执行matchRoutes，所以效率相比于name要低很多
        const path = pathList[i]
        const record = pathMap[path] // 找到当前遍历的path对应的路由记录
        if (matchRoute(record.regex, location.path, location.params)) { // 匹配成功
          return _createRoute(record, location, redirectedFrom) // 返回基于匹配记录和locaton创建的路由
        }
      }
    }
    // no match
    return _createRoute(null, location) // 匹配失败，返回只基于location创建的路由
  }

  function redirect ( // 进行重定向也是通过返回一个匹配的路由来实现，过程和match方法的流程类似——将redirect转化为location——>查找路由记录——>找到了就返回匹配的路由否则返回基于传入的location生成的路由。
    record: RouteRecord,
    location: Location
  ): Route {
    const originalRedirect = record.redirect
    let redirect = typeof originalRedirect === 'function'
      ? originalRedirect(createRoute(record, location, null, router)) // 如果record.redirect为函数则传入匹配的路由来获取redirect
      : originalRedirect // 从路由记录获取redirect

    if (typeof redirect === 'string') { // 若为redirect为字符串则转化为对象(生成location)
      redirect = { path: redirect }
    }

    if (!redirect || typeof redirect !== 'object') {
      if (process.env.NODE_ENV !== 'production') {
        warn(
          false, `invalid redirect option: ${JSON.stringify(redirect)}`
        )
      }
      return _createRoute(null, location) // redirect不合法，则返回非匹配路由
    }

    const re: Object = redirect // 来自路由记录redirect的location对象
    const { name, path } = re
    let { query, hash, params } = location
    // 优先使用record location的这三个参数
    query = re.hasOwnProperty('query') ? re.query : query
    hash = re.hasOwnProperty('hash') ? re.hash : hash
    params = re.hasOwnProperty('params') ? re.params : params

    if (name) { // 优先根据redirect.name来匹配
      // resolved named direct
      const targetRecord = nameMap[name]
      if (process.env.NODE_ENV !== 'production') { // 来自redirect的命名路由匹配失败
        assert(targetRecord, `redirect failed: named route "${name}" not found.`)
      }
      return match({ // 返回和redirect匹配的路由
        _normalized: true,
        name,
        query,
        hash,
        params
      }, undefined, location)
    } else if (path) { //
      // 1. resolve relative redirect // 解析redirect.path为绝对路径path
      const rawPath = resolveRecordPath(path, record)
      // 2. resolve params // 基于params对象解析出符合rawPath规则的URL路径
      const resolvedPath = fillParams(rawPath, params, `redirect route with path "${rawPath}"`)
      // 3. rematch with existing query and hash
      return match({ // 返回和redirect匹配的路由
        _normalized: true,
        path: resolvedPath,
        query,
        hash
      }, undefined, location)
    } else {
      if (process.env.NODE_ENV !== 'production') {
        warn(false, `invalid redirect option: ${JSON.stringify(redirect)}`)
      }
      return _createRoute(null, location) // 没有找到匹配的路由记录，返回非匹配路由
    }
  }

  function alias ( // 处理别名也要返回一个匹配的路由
    record: RouteRecord,
    location: Location,
    matchAs: string
  ): Route { 
    // 基于location.params解析出符合matchAs规则的URL路径
    const aliasedPath = fillParams(matchAs, location.params, `aliased route with path "${matchAs}"`)
    const aliasedMatch = match({ // 返回与aliasedPath匹配的路由，主要用于获取匹配的路由记录
      _normalized: true,
      path: aliasedPath // 基于path来进行匹配
    })
    if (aliasedMatch) { // 这里有点问题，不管匹配是否成功，aliaseMatch都是一个路由对象，这个条件总是为true
      const matched = aliasedMatch.matched
      const aliasedRecord = matched[matched.length - 1] //  获取最后一个路由记录——这个路由记录的组件才是真正被渲染的组件。存在路由嵌套时matched长度就可能大于1了
      location.params = aliasedMatch.params // 将待匹配路由的路径参数赋给location——创建路由时params来源于location
      return _createRoute(aliasedRecord, location) // 返回基于和matchAs匹配的路由
    }
    return _createRoute(null, location) // 不会执行到这一行
  }

  function _createRoute ( // 创建路由
    record: ?RouteRecord,
    location: Location,
    redirectedFrom?: Location
  ): Route {
    // 根据record判断是否需要重定向或处理别名
    if (record && record.redirect) { // 需要重定向则返回重定向后的路由
      return redirect(record, redirectedFrom || location)
    }
    if (record && record.matchAs) { // 需要处理别名则返回matchAs匹配的路由
      return alias(record, location, record.matchAs)
    }
    return createRoute(record, location, redirectedFrom, router) // 返回路由
  }

  return {
    match,
    addRoutes
  }
}
/**
 * 
 * @param {*} regex 
 * @param {*} path 
 * @param {*} params 
 */
function matchRoute ( // match方法中基于location.path来进行匹配时所用的函数，很明显这种匹配相较于match中通过name匹配的方式—— const record = nameMap[name]; if(record) {...} 要复杂且效率低一些
  regex: RouteRegExp,
  path: string,
  params: Object
): boolean {
  const m = path.match(regex) // 获取匹配结果数组

  if (!m) { // 为null表示不匹配
    return false
  } else if (!params) { // 不需要比较路径参数的话则表示匹配成功，不过这个方法没有暴露出去且在此模块中只在match方法中用到了，所以这个条件语句目前来说是多余的。
    return true
  }
  // 返回true之前用匹配结果m和regex.keys对params进行属性填充
  for (let i = 1, len = m.length; i < len; ++i) { // 匹配到的路径参数分组是从索引1开始存放的
    const key = regex.keys[i - 1] // keys存放的都是路径参数配置对象，索引要从0开始
    const val = typeof m[i] === 'string' ? decodeURIComponent(m[i]) : m[i] // 是字符串则进行编码
    if (key) {
      // Fix #1994: using * with props: true generates a param named 0 // 将通配符路径('*')或匿名路径参数('(.*)')转化名为pathMatch的路径参数。
      params[key.name || 'pathMatch'] = val
    }
  }

  return true
}

function resolveRecordPath (path: string, record: RouteRecord): string { // 将路由记录的path解析为绝对路径
  return resolvePath(path, record.parent ? record.parent.path : '/', true)
}
