/* @flow */

import Regexp from 'path-to-regexp'
import { cleanPath } from './util/path'
import { assert, warn } from './util/warn'

export function createRouteMap (
  routes: Array<RouteConfig>, // 路由配置对象数组
  oldPathList?: Array<string>, // 可选参数，之前的路由path数组
  oldPathMap?: Dictionary<RouteRecord>, // 可选参数，之前的path到路由记录的映射表
  oldNameMap?: Dictionary<RouteRecord> // 可选参数，之前的name到路由记录的映射表
): {
  pathList: Array<string>, // path记录数组
  pathMap: Dictionary<RouteRecord>, // path到路由记录的映射表
  nameMap: Dictionary<RouteRecord> // name到路由记录的映射表
} {
  // the path list is used to control path matching priority
  const pathList: Array<string> = oldPathList || [] // 有则复用
  // $flow-disable-line
  const pathMap: Dictionary<RouteRecord> = oldPathMap || Object.create(null) // 有则复用
  // $flow-disable-line
  const nameMap: Dictionary<RouteRecord> = oldNameMap || Object.create(null) // 有则复用

  routes.forEach(route => { // 遍历routes数组，对配置的所有路由进行记录
    addRouteRecord(pathList, pathMap, nameMap, route)
  })

  // ensure wildcard routes are always at the end
  for (let i = 0, l = pathList.length; i < l; i++) { // 确保通配路由位于path数组末尾——因为进行URL匹配时会按照pathList遍历顺序进行，通配路由会发挥它的真正作用——其它路由都不匹配时才匹配
    if (pathList[i] === '*') {
      pathList.push(pathList.splice(i, 1)[0])
      // i减一是为了让下一个元素不会被跳过；l减一为了跳过最后一个元素(因为这个元素已经遍历过勒)
      l--
      i--
    }
  }

  if (process.env.NODE_ENV === 'development') {
    // warn if routes do not include leading slashes
    const found = pathList
    // check for missing leading slash
      .filter(path => path && path.charAt(0) !== '*' && path.charAt(0) !== '/')

    if (found.length > 0) { // pathList中存在非通配符且非'/'开头得路径，那么在开发模式发出警告。
      const pathNames = found.map(path => `- ${path}`).join('\n')
      warn(false, `Non-nested routes must include a leading slash character. Fix the following routes: \n${pathNames}`)
    }
  }

  return {
    pathList,
    pathMap,
    nameMap
  }
}

function addRouteRecord (// 基于路由配置对象生成路由记录对象，然后缓存路由path和路由记录对象。
  pathList: Array<string>,
  pathMap: Dictionary<RouteRecord>,
  nameMap: Dictionary<RouteRecord>,
  route: RouteConfig,
  parent?: RouteRecord,
  matchAs?: string
) {
  const { path, name } = route
  if (process.env.NODE_ENV !== 'production') {
    assert(path != null, `"path" is required in a route configuration.`) // 路由配置中path是必要的
    assert( // 配置得路由组件不能是字符串(组件name)
      typeof route.component !== 'string',
      `route config "component" for path: ${String(
        path || name
      )} cannot be a ` + `string id. Use an actual component instead.`
    )
  }

  const pathToRegexpOptions: PathToRegexpOptions =
    route.pathToRegexpOptions || {} // 获取pathToRegexp方法配置对象，默认为空对象。
  const normalizedPath = normalizePath(path, parent, pathToRegexpOptions.strict) // 获得一个标准化(合法)的路径

  if (typeof route.caseSensitive === 'boolean') { // route.caseSensitive用于配置pathToRegexpOptions.sensitive
    pathToRegexpOptions.sensitive = route.caseSensitive
  }

  const record: RouteRecord = { // 生成路由记录
    path: normalizedPath,
    regex: compileRouteRegex(normalizedPath, pathToRegexpOptions),
    components: route.components || { default: route.component }, // 存放命名视图组件的对象——name(和view-router组件的name prop对应)到路由组件映射对象
    instances: {}, // name到路由组件实例的映射对象，先初始化为空对象
    name, // 路由名称
    parent, // 父级路由记录
    matchAs, // 用于别名匹配的路径
    redirect: route.redirect, // 是否重定向
    beforeEnter: route.beforeEnter,
    meta: route.meta || {},
    props: // 初始化props
      route.props == null
        ? {}
        : route.components
          ? route.props // 这种情况下props应该是一个映射表对象，键和components中name对应
          : { default: route.props }
  }

  if (route.children) { // 存在子路由配置数组时优先用该函数递归地处理各个子路由
    // Warn if route is named, does not redirect and has a default child route.
    // If users navigate to this route by name, the default child will
    // not be rendered (GH Issue #629)
    if (process.env.NODE_ENV !== 'production') {
      if (
        route.name &&
        !route.redirect &&
        route.children.some(child => /^\/?$/.test(child.path))
      ) {
        warn( // 非跳转的命名路由具有一个默认子路由(path为'/'，作为此路其它子路由都不匹配时的默认视图)时，应该将该路由的name设置到默认子路由上，否则会导致一个BUG——使用name导航到该路由时会渲染错误的视图(不是默认子路由的视图)
          false,
          `Named Route '${route.name}' has a default child route. ` +
            `When navigating to this named route (:to="{name: '${
              route.name
            }'"), ` +
            `the default child route will not be rendered. Remove the name from ` +
            `this route and use the name of the default child route for named ` +
            `links instead.`
        )
      }
    }
    route.children.forEach(child => {
      const childMatchAs = matchAs // matchAs有效说明当前路由是别名路由，那么子路由也是别名路由，所以子路由的matchAs为 matchAs/child.path；否则不是别名路由，不配置matchAs参数
        ? cleanPath(`${matchAs}/${child.path}`)
        : undefined
      addRouteRecord(pathList, pathMap, nameMap, child, record, childMatchAs) // 递归地缓存子路由path和子路由记录
    })
  }

  if (!pathMap[record.path]) { // 之前没记录过则将path添加到pathList，同时将该路由记录添加到pathMap中——键为path
    pathList.push(record.path)
    pathMap[record.path] = record
  }

  if (route.alias !== undefined) { // 如果配置了别名
    const aliases = Array.isArray(route.alias) ? route.alias : [route.alias] // 别名可是多个——字符串数组，不过就算不是数组也会转化为数组再处理。
    for (let i = 0; i < aliases.length; ++i) {
      const alias = aliases[i]
      if (process.env.NODE_ENV !== 'production' && alias === path) { // 路由的别名和path相同在开发模式下会发出警告
        warn(
          false,
          `Found an alias with the same value as the path: "${path}". You have to remove that alias. It will be ignored in development.`
        )
        // skip in dev to make it work
        continue // 开发模式下alias与path相同则不会生效
      }

      const aliasRoute = { // 以别名为路径和子路由配置数组构建一个当前路由的别名路由
        path: alias,
        children: route.children
      }
      addRouteRecord( // 将别名路由添加到记录中
        pathList,
        pathMap,
        nameMap,
        aliasRoute,
        parent,
        record.path || '/' // matchAs // 别名路由会配置matchAs属性，匹配URL时通过matchAs进行匹配
      )
    }
  }

  if (name) { // 如果该路由是命名路由
    if (!nameMap[name]) { // 以name作为键将路由记录添加到nameMap中，且不能重复添加
      nameMap[name] = record
    } else if (process.env.NODE_ENV !== 'production' && !matchAs) {// nameMap中已经存在该命名路由，且该路由不是别名路由，那么说明存在两个命名路由使用了相同name属性的情况，在开发模式下会发出警告。
      warn(
        false,
        `Duplicate named routes definition: ` +
          `{ name: "${name}", path: "${record.path}" }`
      )
    }
  }
}

function compileRouteRegex ( // 调用pathToRegexp得到path对应的正则
  path: string,
  pathToRegexpOptions: PathToRegexpOptions
): RouteRegExp {
  const regex = Regexp(path, [], pathToRegexpOptions);
  if (process.env.NODE_ENV !== 'production') {
    const keys: any = Object.create(null)
    regex.keys.forEach(key => {
      warn( // 出现重名的路径参数则发出警告
        !keys[key.name],
        `Duplicate param keys in route with path: "${path}"`
      )
      keys[key.name] = true
    })
  }
  return regex
}

function normalizePath (
  path: string,
  parent?: RouteRecord,
  strict?: boolean
): string {
  if (!strict) path = path.replace(/\/$/, '') // 如果strict为false则去掉path末尾斜杠
  if (path[0] === '/') return path // 斜杠开头表示匹配绝对路径则不需要拼接，直接返回。
  if (parent == null) return path // 父级路由不存在则也不需要拼接，直接返回。
  return cleanPath(`${parent.path}/${path}`) // 满足拼接条件，则与父级路由path拼接后返回。
}
