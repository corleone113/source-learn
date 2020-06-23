/* @flow */

import type Router from '../index'
import { History } from './base'
import { cleanPath } from '../util/path'
import { START } from '../util/route'
import { setupScroll, handleScroll } from '../util/scroll'
import { pushState, replaceState, supportsPushState } from '../util/push-state'

export class HTML5History extends History {
  _startLocation: string // 起始URL路径

  constructor (router: Router, base: ?string) {
    super(router, base)

    this._startLocation = getLocation(this.base) // 用初次加载页面的去掉基路径的URL路径作为起始URL路径
  }

  setupListeners () {
    if (this.listeners.length > 0) {
      return
    }

    const router = this.router
    const expectScroll = router.options.scrollBehavior // 目标
    const supportsScroll = supportsPushState && expectScroll

    if (supportsScroll) { // 如果支持滚动则重置滚动机制
      this.listeners.push(setupScroll()) // 然后添加清理监听器的回调。
    }

    const handleRoutingEvent = () => { // popstate事件触发导航
      const current = this.current // 当前路由——当前页面的路由

      // Avoiding first `popstate` event dispatched in some browsers but first
      // history route not updated since async guard at the same time.
      const location = getLocation(this.base) // 返回当前页面的去掉了指定基路径的URL路径
      if (this.current === START && location === this._startLocation) { // 要导航的目标路径为'/'或当前路径等于其实路径则直接退出
        return
      }

      this.transitionTo(location, route => { // 触发导航
        if (supportsScroll) { // 导航结束且支持滚动就进行滚动处理
          handleScroll(router, route, current, true)
        }
      })
    }
    window.addEventListener('popstate', handleRoutingEvent) // 绑定popstate监听器。点击前进、后退、调用history.go/back/forward会触发popstate事件
    this.listeners.push(() => { // 添加清理监听器的回调。
      window.removeEventListener('popstate', handleRoutingEvent)
    })
  }

  go (n: number) { // 直接调用原始的API即可，
    window.history.go(n)
  }

  push (location: RawLocation, onComplete?: Function, onAbort?: Function) { // 导航到目标位置并添加历史记录项
    const { current: fromRoute } = this
    this.transitionTo(location, route => { // 导航结束时的回调
      pushState(cleanPath(this.base + route.fullPath)) // 变更URL路径，并添加历史记录项
      handleScroll(this.router, route, fromRoute, false)
      onComplete && onComplete(route)
    }, onAbort)
  }

  replace (location: RawLocation, onComplete?: Function, onAbort?: Function) { // 导航到目标位置并替换历史记录项
    const { current: fromRoute } = this
    this.transitionTo(location, route => { // 导航结束时的回调
      replaceState(cleanPath(this.base + route.fullPath)) // 变更URL路径，并替换历史记录项
      handleScroll(this.router, route, fromRoute, false)
      onComplete && onComplete(route)
    }, onAbort)
  }

  ensureURL (push?: boolean) { // 如果当前URL路径和当前路由路径不一致则修改地址栏URL路径为当前路由的路径，并根据push决定是新增还是替换历史记录项，在导航中断或失败时还能回滚URL路径和历史记录项。
    if (getLocation(this.base) !== this.current.fullPath) {
      const current = cleanPath(this.base + this.current.fullPath)
      push ? pushState(current) : replaceState(current)
    }
  }

  getCurrentLocation (): string { // 获取当前完整的URL路径
    return getLocation(this.base)
  }
}

export function getLocation (base: string): string { // 返回当前页面的去掉了指定基路径的URL路径
  let path = decodeURI(window.location.pathname) // 获取当前页面原始URL路径
  if (base && path.toLowerCase().indexOf(base.toLowerCase()) === 0) {
    path = path.slice(base.length) // 如果包含基路径则去除基路径部分
  }
  // 去掉基路径后为空字串则还是以斜杠开头
  return (path || '/') + window.location.search + window.location.hash
}
