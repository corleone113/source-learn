/* @flow */

import type VueRouter from '../index'
import { parsePath, resolvePath } from './path'
import { resolveQuery } from './query'
import { fillParams } from './params'
import { warn } from './warn'
import { extend } from './misc'

export function normalizeLocation ( // 返回标准化的location对象，这个location对象是基于raw(导航目标位置)和当前路由生成的，用于进行路由匹配。
  raw: RawLocation,
  current: ?Route,
  append: ?boolean,
  router: ?VueRouter
): Location {
  let next: Location = typeof raw === 'string' ? { path: raw } : raw // 基于raw生成next(临时目标位置)
  // named target
  if (next._normalized) { // 已经进行过标准化处理则直接返回
    return next
  } else if (next.name) { // 优先使用name进行匹配——性能要高一些，同时发现name属性说明raw是一个location对象，那么next和next引用同一个location对象，此时要对该对象进行深拷贝然后返回。因为location对象结构简单、可预测，所以用浅拷贝函数就可以实现深拷贝。
    next = extend({}, raw)
    const params = next.params
    if (params && typeof params === 'object') { // 存在路径参数对象则也对其进行拷贝
      next.params = extend({}, params)
    }
    return next
  }

  // relative params
  if (!next.path && next.params && current) { // 目标位置(raw)只带有params且传入了当前路由(current)，则基于当前路由返回location，即基于params进行匹配。
    next = extend({}, next) // 对raw进行拷贝
    next._normalized = true
    const params: any = extend(extend({}, current.params), next.params) // 拷贝且合并路径参数对象
    if (current.name) { // 优先使用name进行匹配
      next.name = current.name // 通过name进行匹配而不是path
      next.params = params // 路径参数保存在params对象中
    } else if (current.matched.length) { // matched.length>0则表示当前路由是匹配的
      const rawPath = current.matched[current.matched.length - 1].path // 获取最后一个路由记录的path，因为最后一个路由记录的路由组件才是真正被渲染的组件
      next.path = fillParams(rawPath, params, `path ${current.path}`) // 根据params对象生成匹配rawPath的URL路径字串，将这个字串作为返回的location的path
    } else if (process.env.NODE_ENV !== 'production') { // 以上条件都满足说明传入current不正确
      warn(false, `relative params navigation requires a current route.`)
    }
    return next
  }
  // 以上条件都不满足时才考虑基于next.path进行匹配
  const parsedPath = parsePath(next.path || '') // 转化为包含path,query,hash三个字符串的对象。
  const basePath = (current && current.path) || '/' // 优先考虑当前路由的路径作为基路径，不存在则以'/'作为基路径
  const path = parsedPath.path
    ? resolvePath(parsedPath.path, basePath, append || next.append) // 得到一个URL绝对路径path(带有路径参数)
    : basePath // raw.path无法解析出路径部分(去掉了query和hash的剩余部分)则使用basePath作为返回location的path

  const query = resolveQuery( // 解析出查询参数对象
    parsedPath.query,
    next.query,
    router && router.options.parseQuery
  )

  let hash = next.hash || parsedPath.hash // 优先使用next.hash
  if (hash && hash.charAt(0) !== '#') { // 保证哈希片段是以'#'开头的
    hash = `#${hash}`
  }

  return { // 基于path进行匹配的location
    _normalized: true,
    path,
    query,
    hash
  }
}
