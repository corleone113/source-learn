/* @flow */

import type Router from '../index'
import { History } from './base'
import { cleanPath } from '../util/path'
import { getLocation } from './html5'
import { setupScroll, handleScroll } from '../util/scroll'
import { pushState, replaceState, supportsPushState } from '../util/push-state'

export class HashHistory extends History {
  constructor (router: Router, base: ?string, fallback: boolean) {
    super(router, base)
    // check history fallback deeplinking
    if (fallback && checkFallback(this.base)) { // 确定浏览器不支持history.pushState和history.replaceState且需要回退到哈希模式的路由，这里检查和确保当前使用的哈希模式的URL
      return // 已经进行过确认则退出
    }
    ensureSlash() // 这里主要确保当前是哈希模式的URL
  }

  // this is delayed until the app mounts
  // to avoid the hashchange listener being fired too early
  setupListeners () {
    if (this.listeners.length > 0) {
      return
    }

    const router = this.router
    const expectScroll = router.options.scrollBehavior
    const supportsScroll = supportsPushState && expectScroll

    if (supportsScroll) { // 如果支持滚动则重置滚动机制
      this.listeners.push(setupScroll()) // 然后添加清理监听器的回调。
    }

    const handleRoutingEvent = () => { // popstate/hashchange事件监听器——会触发导航
      const current = this.current
      if (!ensureSlash()) { // 非哈希模式的URL则直接退出
        return
      }
      this.transitionTo(getHash(), route => { // 触发到目标URL路径的导航，在此之前地址栏URL路径已经变更为目标URL路径，所以当前URL路径即目标URL路径
        if (supportsScroll) { // 导航结束且支持滚动就进行滚动处理
          handleScroll(this.router, route, current, true)
        }
        if (!supportsPushState) { // 这里似乎没什么必要
          replaceHash(route.fullPath)
        }
      })
    }
    const eventType = supportsPushState ? 'popstate' : 'hashchange' // 优先考虑使用popstate事件
    window.addEventListener(
      eventType,
      handleRoutingEvent
    )
    this.listeners.push(() => { // 添加清理监听器的回调。
      window.removeEventListener(eventType, handleRoutingEvent)
    })
  }

  push (location: RawLocation, onComplete?: Function, onAbort?: Function) { // 导航到目标位置并添加历史记录项
    const { current: fromRoute } = this // 当前路由作为来源
    this.transitionTo(
      location,
      route => { // 导航结束时的回调
        pushHash(route.fullPath) // 变更URL路径
        handleScroll(this.router, route, fromRoute, false)
        onComplete && onComplete(route)
      },
      onAbort
    )
  }

  replace (location: RawLocation, onComplete?: Function, onAbort?: Function) { // 导航到目标位置并替换历史记录项
    const { current: fromRoute } = this // 当前路由作为来源
    this.transitionTo(
      location,
      route => { // 导航结束时的回调
        replaceHash(route.fullPath) // 变更URL路径
        handleScroll(this.router, route, fromRoute, false)
        onComplete && onComplete(route)
      },
      onAbort
    )
  }

  go (n: number) { // 直接调用原始的API即可，
    window.history.go(n)
  }

  ensureURL (push?: boolean) { // 如果当前URL路径和当前路由路径不一致则修改地址栏URL路径为当前路由的路径，并根据push决定是新增还是替换历史记录项，在导航中断或失败时还能回滚URL路径和历史记录项。
    const current = this.current.fullPath
    if (getHash() !== current) {
      push ? pushHash(current) : replaceHash(current)
    }
  }

  getCurrentLocation () {
    return getHash()
  }
}

function checkFallback (base) { // 检查是否已回退到哈希模式
  const location = getLocation(base) // 获取当前的去掉base部分的URL路径
  if (!/^\/#/.test(location)) { // 不是哈希模式的URL则进行替换
    window.location.replace(cleanPath(base + '/#' + location))
    return true // 表示当前不是哈希模式，但已经切换成功
  }
}

function ensureSlash (): boolean { // 确认当前URL是否使用的哈希模式
  const path = getHash()
  if (path.charAt(0) === '/') { // 表示当前使用的确实是哈希模式，否则将返回空字串
    return true
  }
  replaceHash('/' + path) // 执行到这里说明没有使用哈希模式的路径，则需要修改地址栏URL路径
  return false
}

export function getHash (): string { // 获取当前URL路径——去掉'/#'后的剩余部分
  // We can't use window.location.hash here because it's not
  // consistent across browsers - Firefox will pre-decode it!
  let href = window.location.href
  const index = href.indexOf('#')
  // empty path // 非哈希模式，返回空字串
  if (index < 0) return ''

  href = href.slice(index + 1) // 取#后面的路径部分作为href
  // decode the hash but not the search or hash
  // as search(query) is already decoded
  // https://github.com/vuejs/vue-router/issues/2708
  // 下面的操作为了保证只解码哈希模式路径中路径片段部分，而不会解码查询字串和/或哈希片段
  const searchIndex = href.indexOf('?') // 查询字符串起始索引
  if (searchIndex < 0) {
    const hashIndex = href.indexOf('#') // 哈希片段起始索引
    if (hashIndex > -1) {
      href = decodeURI(href.slice(0, hashIndex)) + href.slice(hashIndex)
    } else href = decodeURI(href)
  } else {
    href = decodeURI(href.slice(0, searchIndex)) + href.slice(searchIndex)
  }

  return href
}

function getUrl (path) { // 获取path对应完整哈希路径
  const href = window.location.href
  const i = href.indexOf('#')
  const base = i >= 0 ? href.slice(0, i) : href
  return `${base}#${path}`
}

function pushHash (path) { // 修改地址栏URL路径为哈希模式的路径
  if (supportsPushState) {
    pushState(getUrl(path)) // 修改了地址栏URL路径，同时添加新的历史记录项
  } else {
    window.location.hash = path // 不支持history.pushState和history.replaceState则直接修改hash，这会触发hashchange事件，从而导致视图重新渲染
  }
}

function replaceHash (path) { // 修改地址栏URL路径为哈希模式的路径
  if (supportsPushState) {
    replaceState(getUrl(path)) // 修改了地址栏URL路径，同时替换当前历史记录项
  } else {
    window.location.replace(getUrl(path)) // 不支持history.pushState和history.repalceState则使用location.replace
  }
}
