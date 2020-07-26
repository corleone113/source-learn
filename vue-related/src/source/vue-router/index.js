/* @flow */

import { install } from './install'
import { START } from './util/route'
import { assert } from './util/warn'
import { inBrowser } from './util/dom'
import { cleanPath } from './util/path'
import { createMatcher } from './create-matcher'
import { normalizeLocation } from './util/location'
import { supportsPushState } from './util/push-state'
import { handleScroll } from './util/scroll'

import { HashHistory } from './history/hash'
import { HTML5History } from './history/html5'
import { AbstractHistory } from './history/abstract'

import type { Matcher } from './create-matcher'

export default class VueRouter {
  static install: () => void;
  static version: string;

  app: any;
  apps: Array<any>;
  ready: boolean;
  readyCbs: Array<Function>;
  options: RouterOptions;
  mode: string;
  history: HashHistory | HTML5History | AbstractHistory;
  matcher: Matcher;
  fallback: boolean; // 浏览器不支持history.pushState和history.replaceState的情况下是否回退到哈希模式
  beforeHooks: Array<?NavigationGuard>;
  resolveHooks: Array<?NavigationGuard>;
  afterHooks: Array<?AfterNavigationHook>;

  constructor (options: RouterOptions = {}) {
    this.app = null // 配置了该Router实例的当前激活的Vue根实例
    this.apps = [] // 缓存配置了该Router实例的Vue实例的数组
    this.options = options // router配置对象。
    this.beforeHooks = [] // 全局前置钩子数组
    this.resolveHooks = [] // 全局解析钩子数组
    this.afterHooks = [] // 全局后置钩子数组
    this.matcher = createMatcher(options.routes || [], this) // 创建的匹配器

    let mode = options.mode || 'hash'// 默认使用哈希模式
    this.fallback = mode === 'history' && !supportsPushState && options.fallback !== false
    if (this.fallback) { // 浏览器不支持history.pushState和history.replaceState且允许回退
      mode = 'hash'
    }
    if (!inBrowser) { // 非浏览器环境下使用抽象路由
      mode = 'abstract'
    }
    this.mode = mode

    switch (mode) { // 根据mode确定history版本
      case 'history':
        this.history = new HTML5History(this, options.base)
        break
      case 'hash':
        this.history = new HashHistory(this, options.base, this.fallback)
        break
      case 'abstract':
        this.history = new AbstractHistory(this, options.base)
        break
      default:
        if (process.env.NODE_ENV !== 'production') {
          assert(false, `invalid mode: ${mode}`)
        }
    }
  }

  match ( // 引用matcher.match
    raw: RawLocation,
    current?: Route,
    redirectedFrom?: Location
  ): Route {
    return this.matcher.match(raw, current, redirectedFrom)
  }

  get currentRoute (): ?Route { // 返回当前路由
    return this.history && this.history.current
  }

  init (app: any /* Vue component instance */) { // init方法在install方法中调用，与配置该router的组件实例关联起来，并进行其它一些初始化工作
    process.env.NODE_ENV !== 'production' && assert( // 确保调用init方法时已经安装了vue-router插件
      install.installed,
      `not installed. Make sure to call \`Vue.use(VueRouter)\` ` +
      `before creating root instance.`
    )

    this.apps.push(app) // 缓存配置了该router的Vue(组件)实例

    // set up app destroyed handler
    // https://github.com/vuejs/vue-router/issues/2639
    app.$once('hook:destroyed', () => { // 为app绑定卸载钩子监听器
      // clean out app from this.apps array once destroyed
      const index = this.apps.indexOf(app) // 获取该组件实例在缓存数组中的索引
      if (index > -1) this.apps.splice(index, 1) // 从缓存中移除
      // ensure we still have a main app or null if no apps
      // we do not release the router so it can be reused
      if (this.app === app) this.app = this.apps[0] || null // 取下一个组件实例作为当前激活的Vue组件实例

      if (!this.app) { // 如果当前没有激活的Vue组件实例，则进行清理工作
        // clean up event listeners
        // https://github.com/vuejs/vue-router/issues/2341
        this.history.teardownListeners() // 通过this.history清理事件监听器
      }
    })

    // main app previously initialized
    // return as we don't need to set up new history listener
    if (this.app) { // 当前Vue组件实例不为空则不需要进行后面初始化了，只是添加组件实例到this.apps中
      return
    }

    this.app = app

    const history = this.history

    if (history instanceof HTML5History || history instanceof HashHistory) {
      const handleInitialScroll = (routeOrError) => { // 初次导航完成(不管成功还是失败)时的滚动处理回调
        const from = history.current
        const expectScroll = this.options.scrollBehavior // 路由器(router)配置对象中用户提供的滚动行为回调
        const supportsScroll = supportsPushState && expectScroll // 支持history.pushState和history.replaceState 才支持滚动处理

        if (supportsScroll && 'fullPath' in routeOrError) { // 支持滚动处理且传入滚动回调的参数对象包含fullPath——导航的目标URL路径
          handleScroll(this, routeOrError, from, false) // 处理滚动
        }
      }
      const setupListeners = (routeOrError) => { // 注册初次导航完成(不管成功还是失败)时的监听器
        history.setupListeners() // 注册滚动和导航的事件监听器和清理监听器的回调
        handleInitialScroll(routeOrError)
      }
      history.transitionTo(history.getCurrentLocation(), setupListeners, setupListeners) // 对当前URL路径进行初次导航，且无论成功还是失败都要注册事件(popstate,hashchange)监听器。
    }

    history.listen(route => { // 监听导航
      this.apps.forEach((app) => { // 更新所有配置了该路由器的Vue实例的_route属性以便出router-view组件的重新渲染
        app._route = route
      })
    })
  }

  beforeEach (fn: Function): Function { // 注册全局前置守卫
    return registerHook(this.beforeHooks, fn)
  }

  beforeResolve (fn: Function): Function { // 注册全局解析守卫
    return registerHook(this.resolveHooks, fn)
  }

  afterEach (fn: Function): Function { // 注册全局后置守卫
    return registerHook(this.afterHooks, fn)
  }

  onReady (cb: Function, errorCb?: Function) { // 注册初次导航完成时的监听器
    this.history.onReady(cb, errorCb)
  }

  onError (errorCb: Function) { // 注册路由准备失败时的监听器
    this.history.onError(errorCb)
  }

  push (location: RawLocation, onComplete?: Function, onAbort?: Function) { // 导航到目标位置并新增历史记录项，导航过程是异步的。
    // $flow-disable-line
    if (!onComplete && !onAbort && typeof Promise !== 'undefined') {
      return new Promise((resolve, reject) => { // 没有传入回调则改造为promise
        this.history.push(location, resolve, reject)
      })
    } else { // 有回调则直接调用
      this.history.push(location, onComplete, onAbort)
    }
  }

  replace (location: RawLocation, onComplete?: Function, onAbort?: Function) { // 导航目标位置并替换历史记录项，导航过程是异步的。
    // $flow-disable-line
    if (!onComplete && !onAbort && typeof Promise !== 'undefined') {
      return new Promise((resolve, reject) => { // 没有传入回调则改造为promise
        this.history.replace(location, resolve, reject)
      })
    } else { // 有回调则直接调用
      this.history.replace(location, onComplete, onAbort)
    }
  }

  go (n: number) { // 对于go、back、forward等本来就是跳转的操作直接调用原生接口
    this.history.go(n)
  }

  back () {
    this.go(-1)
  }

  forward () {
    this.go(1)
  }

  getMatchedComponents (to?: RawLocation | Route): Array<any> { // 获取和指定路由/位置或当前路由匹配的路由组件数组
    const route: any = to
      ? to.matched
        ? to // to为Route则使用to
        : this.resolve(to).route // to为location则使用与其匹配的路由
      : this.currentRoute // 没有传入to则使用当前路由
    if (!route) {
      return []
    }
    return [].concat.apply([], route.matched.map(m => { // 将匹配路由的matched中所有路由记录的所有组件放到一个数组中然后返回这个数组
      return Object.keys(m.components).map(key => {
        return m.components[key]
      })
    }))
  }

  resolve ( // 根据目标位置解析出:标准化location、匹配路由、完整路径字符串等组成的对象
    to: RawLocation,
    current?: Route,
    append?: boolean
  ): {
    location: Location,
    route: Route,
    href: string,
    // for backwards compat
    normalizedTo: Location,
    resolved: Route
  } {
    current = current || this.history.current
    const location = normalizeLocation( // 将目标位置转化为标准化的location
      to,
      current,
      append,
      this
    )
    const route = this.match(location, current) // 获取导航目标匹配的路由
    const fullPath = route.redirectedFrom || route.fullPath // 完整路径，优先考虑重定向前的路径
    const base = this.history.base // 基路径
    const href = createHref(base, fullPath, this.mode) // 获取当前模式下fullPath的完整路径
    return {
      location,
      route,
      href,
      // for backwards compat // 为了兼容之前的版本
      normalizedTo: location,
      resolved: route
    }
  }

  addRoutes (routes: Array<RouteConfig>) { // 添加新的路由配置数组
    this.matcher.addRoutes(routes)
    if (this.history.current !== START) { // 添加后若当前路径不是'/'则重新导航
      this.history.transitionTo(this.history.getCurrentLocation())
    }
  }
}

function registerHook (list: Array<any>, fn: Function): Function { // 注册钩子，返回注销钩子的回调。
  list.push(fn)
  return () => {
    const i = list.indexOf(fn)
    if (i > -1) list.splice(i, 1)
  }
}

function createHref (base: string, fullPath: string, mode) { // 返回指定模式的对应完整URL路径
  var path = mode === 'hash' ? '#' + fullPath : fullPath
  return base ? cleanPath(base + '/' + path) : path
}

VueRouter.install = install
VueRouter.version = '__VERSION__'

if (inBrowser && window.Vue) { // 浏览器环境下自动安装vue-router
  window.Vue.use(VueRouter)
}
