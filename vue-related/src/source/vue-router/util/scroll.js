/* @flow */

import type Router from '../index'
import { assert } from './warn'
import { getStateKey, setStateKey } from './state-key'
import { extend } from './misc'

const positionStore = Object.create(null)

export function setupScroll () { // 自定义浏览器前进/后退/跳跃(go)的滚动行为
  // Prevent browser scroll behavior on History popstate
  if ('scrollRestoration' in window.history) { // 阻止浏览器默认的导航结束时的滚动行为
    window.history.scrollRestoration = 'manual'
  }
  // Fix for #1585 for Firefox
  // Fix for #2195 Add optional third attribute to workaround a bug in safari https://bugs.webkit.org/show_bug.cgi?id=182678
  // Fix for #2774 Support for apps loaded from Windows file shares not mapped to network drives: replaced location.origin with
  // window.location.protocol + '//' + window.location.host
  // location.host contains the port and location.hostname doesn't
  const protocolAndPath = window.location.protocol + '//' + window.location.host
  const absolutePath = window.location.href.replace(protocolAndPath, '') // 得到URL绝对路径
  // preserve existing history state as it could be overriden by the user
  const stateCopy = extend({}, window.history.state)
  stateCopy.key = getStateKey() // 复用缓存的时间戳key
  window.history.replaceState(stateCopy, '', absolutePath) // 重置当前历史记录项，方便后续通过时间戳key复用滚动条坐标
  window.addEventListener('popstate', handlePopState) // 触发popstate时只是缓存滚动条坐标，而不会进行滚动
  return () => {
    window.removeEventListener('popstate', handlePopState)
  }
}

export function handleScroll ( // 处理滚动
  router: Router,
  to: Route,
  from: Route,
  isPop: boolean // 是否触发popstate事件
) {
  if (!router.app) { // 如果路由器还没有初始化(调用init)，则直接退出
    return
  }

  const behavior = router.options.scrollBehavior
  if (!behavior) { // 路由器配置中没有提供滚动行为回调则直接退出
    return
  }

  if (process.env.NODE_ENV !== 'production') {
    assert(typeof behavior === 'function', `scrollBehavior must be a function`)
  }

  // wait until re-render finishes before scrolling
  router.app.$nextTick(() => { // 渲染结束后再滚动
    const position = getScrollPosition() // 以缓存的滚动条坐标初始化position
    const shouldScroll = behavior.call( // 获取滚动回调结果
      router,
      to,
      from,
      isPop ? position : null // 是popstate事件触发的(即回退行为)则传入缓存的坐标
    )

    if (!shouldScroll) { // 没有返回值则直接退出
      return
    }

    if (typeof shouldScroll.then === 'function') { // 如果滚动回调结果是promise则通过then,catch的回调进行滚动
      shouldScroll
        .then(shouldScroll => {
          scrollToPosition((shouldScroll: any), position)
        })
        .catch(err => {
          if (process.env.NODE_ENV !== 'production') { // 开发模式抛出捕获的异常
            assert(false, err.toString())
          }
        })
    } else { // 非promise直接进行滚动
      scrollToPosition(shouldScroll, position)
    }
  })
}

export function saveScrollPosition () { // 以时间戳key为键缓存当前文档滚动条坐标信息
  const key = getStateKey()
  if (key) {
    positionStore[key] = {
      x: window.pageXOffset,
      y: window.pageYOffset
    }
  }
}

function handlePopState (e) { // popstate事件监听器
  saveScrollPosition() // 缓存当前文档(document)滚动条坐标
  if (e.state && e.state.key) { // 重置时间戳key为出栈历史记录项state的key，这样下次回退到该历史记录项时可以通过时间戳key能拿到对应的页面滚动条坐标了
    setStateKey(e.state.key)
  }
}

function getScrollPosition (): ?Object {
  const key = getStateKey() // 获取当前历史记录项state.key
  if (key) { // 如果是缓存过位置则返回该位置
    return positionStore[key]
  }
}

function getElementPosition (el: Element, offset: Object): Object { // 获取以元素为基准时的偏移坐标
  const docEl: any = document.documentElement
  const docRect = docEl.getBoundingClientRect() // 获取当前整个页面文档的尺寸、坐标
  const elRect = el.getBoundingClientRect() // 获取元素的尺寸、坐标
  return { // 通过getBoundingClientRect获得对象的偏移位置是相对于浏览器视图窗口左上角的
    x: elRect.left - docRect.left - offset.x, // elRect.left-docRect.left得到元素相对于文档左边缘的偏移量，设为x1，向右滚动x1个px就会让元素左侧与视图窗口左边缘对齐，而offset.x表示滚动后元素相对于视图窗口左边缘的偏移量，所以应该最终偏移量应该是x1 - offset.x，即：elRect.left - docRect.left - offset.x。
    y: elRect.top - docRect.top - offset.y // 该表达式的原理和上面x的一样。
  }
}

function isValidPosition (obj: Object): boolean { // 判断坐标对象是否合法
  return isNumber(obj.x) || isNumber(obj.y)
}

function normalizePosition (obj: Object): Object { // 获取合法的坐标对象
  return {
    x: isNumber(obj.x) ? obj.x : window.pageXOffset,
    y: isNumber(obj.y) ? obj.y : window.pageYOffset
  }
}

function normalizeOffset (obj: Object): Object { // x/y存在则使用原值否则改为0
  return {
    x: isNumber(obj.x) ? obj.x : 0,
    y: isNumber(obj.y) ? obj.y : 0
  }
}

function isNumber (v: any): boolean {
  return typeof v === 'number'
}

const hashStartsWithNumberRE = /^#\d/

function scrollToPosition (shouldScroll, position) { // 文档页面滚动到指定坐标
  const isObject = typeof shouldScroll === 'object'
  if (isObject && typeof shouldScroll.selector === 'string') { // 传入selector(元素选择器)则重新计算坐标
    // getElementById would still fail if the selector contains a more complicated query like #main[data-attr]
    // but at the same time, it doesn't make much sense to select an element with an id and an extra selector
    const el = hashStartsWithNumberRE.test(shouldScroll.selector) // $flow-disable-line
      ? document.getElementById(shouldScroll.selector.slice(1)) // $flow-disable-line // 使用纯数字id作为选择器就通过getElementById进行查询
      : document.querySelector(shouldScroll.selector) // 否则使用querySelector方法进行查询

    if (el) { // 找到对应元素dom的话则滚动到元素所在位置，和书签的效果一样
      let offset = // 获取偏移坐标
        shouldScroll.offset && typeof shouldScroll.offset === 'object'
          ? shouldScroll.offset
          : {}
      offset = normalizeOffset(offset) // 得到合法的坐标
      position = getElementPosition(el, offset) // 获取以指定元素为参照的偏移坐标
    } else if (isValidPosition(shouldScroll)) { // 找不到对应元素时直接使用原值
      position = normalizePosition(shouldScroll)
    }
  } else if (isObject && isValidPosition(shouldScroll)) { // 不带选择器属性的话
    position = normalizePosition(shouldScroll)
  }

  if (position) {
    window.scrollTo(position.x, position.y) // 让文档滚动到指定坐标
  }
}
