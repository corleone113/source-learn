/* @flow */

import { _Vue } from '../install'
import type Router from '../index'
import { inBrowser } from '../util/dom'
import { runQueue } from '../util/async'
import { warn, isError, isRouterError } from '../util/warn'
import { START, isSameRoute } from '../util/route'
import {
  flatten,
  flatMapComponents,
  resolveAsyncComponents
} from '../util/resolve-components'
import {
  createNavigationDuplicatedError,
  createNavigationCancelledError,
  createNavigationRedirectedError,
  createNavigationAbortedError,
  NavigationFailureType
} from './errors'

export class History {
  router: Router  // 路由器
  base: string  // 基路径
  current: Route // 当前路由
  pending: ?Route // 导航中的路由
  cb: (r: Route) => void
  ready: boolean // 导航是否结束
  readyCbs: Array<Function>
  readyErrorCbs: Array<Function>
  errorCbs: Array<Function>
  listeners: Array<Function>
  cleanupListeners: Function

  // implemented by sub-classes
  +go: (n: number) => void
  +push: (loc: RawLocation, onComplete?: Function, onAbort?: Function) => void
  +replace: (loc: RawLocation, onComplete?: Function, onAbort?: Function) => void
  +ensureURL: (push?: boolean) => void
  +getCurrentLocation: () => string
  +setupListeners: Function

  constructor (router: Router, base: ?string) {
    this.router = router // 初始化router对象
    this.base = normalizeBase(base) // 用合法的基路径初始化base
    // start with a route object that stands for "nowhere"
    this.current = START // 用path为'/'的路由初始化current
    this.pending = null // 导航中的路由初始化为null
    this.ready = false
    this.readyCbs = []
    this.readyErrorCbs = []
    this.errorCbs = []
    this.listeners = [] // 清除事件监听器的回调数组
  }

  listen (cb: Function) { // 注册监听导航的回调
    this.cb = cb
  }

  onReady (cb: Function, errorCb: ?Function) { // 注册路由准备成功的回调，也可以注册路由准备失败的回调
    if (this.ready) { // 如果已经准备好则直接调用
      cb()
    } else {
      this.readyCbs.push(cb)
      if (errorCb) {
        this.readyErrorCbs.push(errorCb)
      }
    }
  }

  onError (errorCb: Function) { // 注册路由准备失败的回调
    this.errorCbs.push(errorCb)
  }

  transitionTo ( // 导航到location
    location: RawLocation,
    onComplete?: Function,
    onAbort?: Function
  ) {
    const route = this.router.match(location, this.current) // 获取和location匹配的路由
    this.confirmTransition(
      route,
      () => { // 导航完成时的回调
        const prev = this.current // 更新上一次的路由
        this.updateRoute(route) // 更新当前路由
        onComplete && onComplete(route) // 执行transitionTo接收的导航结束回调
        this.ensureURL() // 确保url路径正确
        this.router.afterHooks.forEach(hook => { // 调用router.afterEach守卫
          hook && hook(route, prev)
        })

        // fire ready cbs once
        if (!this.ready) { // 执行路由准备好回调，且只会执行一次
          this.ready = true
          this.readyCbs.forEach(cb => {
            cb(route)
          })
        }
      },
      err => { // 导航失败则执行传入的中断回调
        if (onAbort) {
          onAbort(err)
        }
        if (err && !this.ready) { // 路由准备失败
          this.ready = true
          // Initial redirection should still trigger the onReady onSuccess
          // https://github.com/vuejs/vue-router/issues/3225
          if (!isRouterError(err, NavigationFailureType.redirected)) { // 如果不是RouterError类型的错误则执行readyErrorCbs中的回调
            this.readyErrorCbs.forEach(cb => {
              cb(err)
            })
          } else { // 否则执行readyCbs中的回调。
            this.readyCbs.forEach(cb => {
              cb(route)
            })
          }
        }
      }
    )
  }

  confirmTransition (route: Route, onComplete: Function, onAbort?: Function) {
    const current = this.current
    const abort = err => { // 导航失败的回调
      // changed after adding errors with
      // https://github.com/vuejs/vue-router/pull/3047 before that change,
      // redirect and aborted navigation would produce an err == null
      if (!isRouterError(err) && isError(err)) { // 处理非RouterError类型的错误
        if (this.errorCbs.length) {
          this.errorCbs.forEach(cb => {
            cb(err)
          })
        } else {
          warn(false, 'uncaught error during route navigation:')
          console.error(err)
        }
      }
      onAbort && onAbort(err) // 有中断回调则执行
    }
    // 取最后一个匹配是因为最后一个匹配的路由组件才是用于渲染的组件
    const lastRouteIndex = route.matched.length - 1 // 导航目标路由的最有一个匹配记录的索引
    const lastCurrentIndex = current.matched.length - 1 // 当前路由的最后一个匹配记录的索引
    if ( // 如果目标路由和当前路由以及它们的匹配路由记录都一致，则抛出重复导航异常
      isSameRoute(route, current) &&
      // in the case the route map has been dynamically appended to
      lastRouteIndex === lastCurrentIndex &&
      route.matched[lastRouteIndex] === current.matched[lastCurrentIndex]
    ) {
      this.ensureURL() // 回滚地址栏URL路径，并添加新的历史记录项
      return abort(createNavigationDuplicatedError(current, route))
    }

    const { updated, deactivated, activated } = resolveQueue( // 得到：复用的、激活的、失活的 三个路由记录数组
      this.current.matched,
      route.matched
    )

    const queue: Array<?NavigationGuard> = [].concat( // 按照执行顺序将各种导航守卫排成一个队列，其中的数组会被展开
      // in-component leave guards
      extractLeaveGuards(deactivated), // 失活的组件的beforeRouteLeave守卫数组
      // global before hooks
      this.router.beforeHooks, // 全局的beforeEach守卫数组
      // in-component update hooks
      extractUpdateHooks(updated), // 复用的组件的beforeRouteUpdate守卫数组
      // in-config enter guards
      activated.map(m => m.beforeEnter), // 匹配路由的beforeEnter守卫数组
      // async components
      resolveAsyncComponents(activated) // 解析激活的组件中的异步组件
    )

    this.pending = route
    const iterator = (hook: NavigationGuard, next) => { // 导航守卫的执行器
      if (this.pending !== route) { // 导航中路由和当前路由不一样说明导航取消了
        return abort(createNavigationCancelledError(current, route))
      }
      try {
        hook(route, current, (to: any) => { // 执行守卫
          if (to === false) { // next(false)表示中断导航
            // next(false) -> abort navigation, ensure current URL
            this.ensureURL(true) // 回滚URL路径和历史记录项
            abort(createNavigationAbortedError(current, route))
          } else if (isError(to)) { // 通过next主动抛出异常
            this.ensureURL(true) // 回滚URL路径和历史记录项
            abort(to)
          } else if ( // 传入next回调的是location则进行重定向
            typeof to === 'string' ||
            (typeof to === 'object' &&
              (typeof to.path === 'string' || typeof to.name === 'string'))
          ) {
            // next('/') or next({ path: '/' }) -> redirect
            abort(createNavigationRedirectedError(current, route)) // 通过next主动重定向会导致产生一个重定向导航异常
            if (typeof to === 'object' && to.replace) { // 如果需要重定向
              this.replace(to) // 调用history.replace
            } else {
              this.push(to) // 调用history.push
            }
          } else { // 这种情况to一般是没有传入，则继续导航
            // confirm transition and pass on the value
            next(to)
          }
        })
      } catch (e) {
        abort(e) // 捕获到异常则中断导航。
      }
    }

    runQueue(queue, iterator, () => {
      const postEnterCbs = [] // 收集beforeRouteEnter执行时传入next的回调
      const isValid = () => this.current === route // 判断是否开始新的导航
      // wait until async components are resolved before
      // extracting in-component enter guards
      const enterGuards = extractEnterGuards(activated, postEnterCbs, isValid)
      const queue = enterGuards.concat(this.router.resolveHooks) // 执行激活的组件的beforeRouteEnter守卫和路由器的beforeResolve守卫
      runQueue(queue, iterator, () => {
        if (this.pending !== route) { // 守卫执行时如果修改了route(匹配路由)，则中断导航
          return abort(createNavigationCancelledError(current, route))
        }
        this.pending = null // 导航结束
        onComplete(route)
        if (this.router.app) { // 存在激活的Vue组件实例，则处理beforeRouteEnter传给next的回调
          this.router.app.$nextTick(() => {
            postEnterCbs.forEach(cb => { // 调用beforeRouteEnter守卫传递给next的回调
              cb() // 用轮询函数封装过的回调，使用的参数来自其闭包作用域
            })
          })
        }
      })
    })
  }

  updateRoute (route: Route) { // 导航结束时更新当前路由
    this.current = route // 更新当前路由
    this.cb && this.cb(route) // 执行监听导航的回调
  }

  setupListeners () {
    // Default implementation is empty
  }

  teardownListeners () { // 遍历执行清理事件监听器的回调，然后清空该回调数组
    this.listeners.forEach(cleanupListener => {
      cleanupListener()
    })
    this.listeners = []
  }
}

function normalizeBase (base: ?string): string { // 获取标准化(合法)的基路径
  if (!base) { // 如果传入的基路径不合法
    if (inBrowser) { // 浏览器环境下
      // respect <base> tag
      const baseEl = document.querySelector('base') // 查询base标签
      base = (baseEl && baseEl.getAttribute('href')) || '/' // 如果存在base标签则使用其href作为URL基路径
      // strip full URL origin
      base = base.replace(/^https?:\/\/[^/]+/, '') // 去掉主机部分
    } else { // 非浏览器环境则直接返回 '/'
      base = '/'
    }
  }
  // make sure there's the starting slash
  if (base.charAt(0) !== '/') { // 确保斜杠开头，因为必须相对于根目录
    base = '/' + base
  }
  // remove trailing slash // 去掉尾斜杠
  return base.replace(/\/$/, '')
}

function resolveQueue ( // 根据当前路由的路由记录表和匹配路由的路由记录表解析出：复用的、激活的、失活的 三部分路由记录表
  current: Array<RouteRecord>,
  next: Array<RouteRecord>
): {
  updated: Array<RouteRecord>,
  activated: Array<RouteRecord>,
  deactivated: Array<RouteRecord>
} {
  let i
  const max = Math.max(current.length, next.length)
  for (i = 0; i < max; i++) {
    if (current[i] !== next[i]) { // i 为第一个不一样的路由记录的索引位置
      break
    }
  }
  return {
    updated: next.slice(0, i),
    activated: next.slice(i),
    deactivated: current.slice(i)
  }
}

function extractGuards ( // 返回提取的组件内导航守卫的回调数组。
  records: Array<RouteRecord>,
  name: string, // 守卫名称
  bind: Function,
  reverse?: boolean // 是否反转
): Array<?Function> {
  const guards = flatMapComponents(records, (def, instance, match, key) => { // 将路由记录数组映射为组件守卫数组
    const guard = extractGuard(def, name) // 提取路由组件上的守卫
    if (guard) {
      return Array.isArray(guard)
        ? guard.map(guard => bind(guard, instance, match, key))
        : bind(guard, instance, match, key)
    }
  })
  return flatten(reverse ? guards.reverse() : guards)
}

function extractGuard ( // 提取组件上导航守卫(钩子方法)，有可能有多个守卫(即导航守卫的数组)
  def: Object | Function,
  key: string
): NavigationGuard | Array<NavigationGuard> {
  if (typeof def !== 'function') {
    // extend now so that global mixins are applied.
    def = _Vue.extend(def) // 全局mixin可能混入了组件内导航守卫，所以使用Vue.extend构建的组件。
  }
  return def.options[key]
}

function extractLeaveGuards (deactivated: Array<RouteRecord>): Array<?Function> { //返回封装后的beforeRouteLeave守卫数组
  return extractGuards(deactivated, 'beforeRouteLeave', bindGuard, true)
}

function extractUpdateHooks (updated: Array<RouteRecord>): Array<?Function> { //返回封装后的beforeRouteUpdate守卫数组
  return extractGuards(updated, 'beforeRouteUpdate', bindGuard)
}

function bindGuard (guard: NavigationGuard, instance: ?_Vue): ?NavigationGuard { // 返回绑定了this的守卫。
  if (instance) {
    return function boundRouteGuard () {
      return guard.apply(instance, arguments)
    }
  }
}

function extractEnterGuards ( // 返回封装后的beforeRouteEnter守卫数组
  activated: Array<RouteRecord>,
  cbs: Array<Function>,
  isValid: () => boolean
): Array<?Function> {
  return extractGuards(
    activated,
    'beforeRouteEnter',
    (guard, _, match, key) => {
      return bindEnterGuard(guard, match, key, cbs, isValid)
    }
  )
}

function bindEnterGuard ( // 对beforeRouteEnter守卫进行封装以便能处理回调
  guard: NavigationGuard,
  match: RouteRecord,
  key: string,
  cbs: Array<Function>,
  isValid: () => boolean
): NavigationGuard {
  return function routeEnterGuard (to, from, next) {
    return guard(to, from, cb => { // 对next进行封装，以便能处理回调
      if (typeof cb === 'function') { // 可以传给next一个回调，在回调中可以访问到组件实例
        cbs.push(() => { // 先存在回调数组中，导航结束再执行
          // #750
          // if a router-view is wrapped with an out-in transition,
          // the instance may not have been registered at this time.
          // we will need to poll for registration until current route
          // is no longer valid.
          poll(cb, match.instances, key, isValid) // 通过轮询保证能让cb中可以访问组件实例
        })
      }
      next(cb) // 非回调则交给next处理
    })
  }
}

function poll ( // 轮询函数，直到组件实例创建完成才结束执行
  cb: any, // somehow flow cannot infer this is a function // 传给next的回调，通过这个回调可以访问组件实例
  instances: Object,
  key: string,
  isValid: () => boolean
) {
  if ( // 组件实例已经创建完成且这个组件不是正在销毁的组件
    instances[key] &&
    !instances[key]._isBeingDestroyed // do not reuse being destroyed instance
  ) {
    cb(instances[key]) // 此时回调可以访问组件实例了
  } else if (isValid()) { // 组件还未创建完成且未开始下一次导航，则继续轮询
    setTimeout(() => {
      poll(cb, instances, key, isValid)
    }, 16)
  }
}
