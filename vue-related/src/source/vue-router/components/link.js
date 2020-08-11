/* @flow */

import { createRoute, isSameRoute, isIncludedRoute } from '../util/route'
import { extend } from '../util/misc'
import { normalizeLocation } from '../util/location'
import { warn } from '../util/warn'

// work around weird flow bug
const toTypes: Array<Function> = [String, Object]
const eventTypes: Array<Function> = [String, Array]

const noop = () => {}

export default {
  name: 'RouterLink',
  props: {
    to: {
      type: toTypes, // 目标位置(目标location)
      required: true
    },
    tag: { // 该链接组件的元素标签类型
      type: String,
      default: 'a'
    },
    exact: Boolean, // 是否精确匹配
    append: Boolean, // 如果to指定的路径为相对路径，则true表示拼接，false表示替换——比如当前URL路径为'/root/some/path'，而to或to.path为'page'，那么当append为true时目标路径为'/root/some/path/page',否则为'/root/some/page'
    replace: Boolean, // 为true则调用router.replace，否则调用router.push
    activeClass: String, // 当前路由匹配时应用于该链接的class
    exactActiveClass: String, // 当前路由精确匹配时应用于该链接的class
    ariaCurrentValue: { // 当前URL路径和to指定的路径精确匹配时配置的aria-current的值
      type: String,
      default: 'page'
    },
    event: { // 触发导航的事件类型
      type: eventTypes,
      default: 'click'
    }
  },
  render (h: Function) {
    const router = this.$router
    const current = this.$route
    const { location, route, href } = router.resolve( // 解析出目标位置匹配时location、匹配路由、路径字符串。这些对象仅在创建链接时使用
      this.to,
      current,
      this.append
    )

    const classes = {}
    const globalActiveClass = router.options.linkActiveClass // 全局activeClass
    const globalExactActiveClass = router.options.linkExactActiveClass // 全局exactActiveClass
    // Support global empty active class
    const activeClassFallback =
      globalActiveClass == null ? 'router-link-active' : globalActiveClass // 备用的activeClass
    const exactActiveClassFallback =
      globalExactActiveClass == null
        ? 'router-link-exact-active'
        : globalExactActiveClass // 备用的exactActiveClass
    const activeClass =
      this.activeClass == null ? activeClassFallback : this.activeClass // 没有配置activeClass则使用备用版本
    const exactActiveClass =
      this.exactActiveClass == null
        ? exactActiveClassFallback
        : this.exactActiveClass // 没有配置exactActiveClass则使用备用版本

    const compareTarget = route.redirectedFrom // 创建和目标位置匹配时的路由，用于进行比较
      ? createRoute(null, normalizeLocation(route.redirectedFrom), null, router) // 已经重定向过则需要创建一个跳转前地址的路由，所以如果该链接指向一个重定向路由，则永远无法应用activeClass，触发跳转前的路径和跳转后的可以匹配
      : route // 没重定向过则不需要新建
    // 需要在创建链接时生成激活状态class
    classes[exactActiveClass] = isSameRoute(current, compareTarget) // 当前路由和用于比较的路由完全一样则表示精确匹配
    classes[activeClass] = this.exact
      ? classes[exactActiveClass] // exact为true时使用exactActiveClass
      : isIncludedRoute(current, compareTarget) // exact为false时基于路由的路径信息进行比较，路径不需要完全一致，比如current.path为'/some' 而compareTarget.path为'/'时也算是匹配。

    const ariaCurrentValue = classes[exactActiveClass] ? this.ariaCurrentValue : null // 精确匹配时才设置aria-current属性

    const handler = e => { // 触发导航的回调
      if (guardEvent(e)) { // 在非重定向的情况才开启导航
        if (this.replace) {
          router.replace(location, noop)
        } else {
          router.push(location, noop)
        }
      }
    }

    const on = { click: guardEvent } // 为click绑定默认的监听器
    if (Array.isArray(this.event)) { // 给指定的事件绑定触发导航的监听器
      this.event.forEach(e => {
        on[e] = handler
      })
    } else {
      on[this.event] = handler
    }

    const data: any = { class: classes }
    const scopedSlot =
      !this.$scopedSlots.$hasNormal && // 没有匿名插槽
      this.$scopedSlots.default && // 含有默认作用域插槽
      this.$scopedSlots.default({
        href,
        route,
        navigate: handler,
        isActive: classes[activeClass],
        isExactActive: classes[exactActiveClass]
      }) // 渲染默认作用域插槽的内容

    if (scopedSlot) { // 存在默认作用域插槽的渲染内容则使用它作为链接组件的渲染结果
      if (scopedSlot.length === 1) { // 插槽内容子节点只有一个则直接返回
        return scopedSlot[0]
      } else if (scopedSlot.length > 1 || !scopedSlot.length) { // 插槽内容子节点大于1或等于0则另外处理
        if (process.env.NODE_ENV !== 'production') {
          warn(
            false,
            `RouterLink with to="${
              this.to
            }" is trying to use a scoped slot but it didn't provide exactly one child. Wrapping the content with a span element.`
          )
        }
        return scopedSlot.length === 0 ? h() : h('span', {}, scopedSlot) // 大于1则就用span元素包裹；等于0则不进行渲染
      }
    }

    if (this.tag === 'a') { // 如果是a元素
      data.on = on
      data.attrs = { href, 'aria-current': ariaCurrentValue }
    } else {
      // find the first <a> child and apply listener and href
      const a = findAnchor(this.$slots.default) // 找到子孙节点中的a元素的vnode，然后修改其数据对象的attrs和on，避免发生冲突。
      if (a) {
        // in case the <a> is a static node
        a.isStatic = false
        const aData = (a.data = extend({}, a.data)) // 浅拷贝a元素vnode上的数据对象
        aData.on = aData.on || {} // 初始化事件监听器对象,由于是浅拷贝aData.on和a.data.on指向相同的引用
        // transform existing events in both objects into arrays so we can push later
        for (const event in aData.on) {
          const handler = aData.on[event]
          if (event in on) { // 如果一个事件的监听器只有一个则将其转化为数组
            aData.on[event] = Array.isArray(handler) ? handler : [handler]
          }
        }
        // append new listeners for router-link
        for (const event in on) {
          if (event in aData.on) {
            // on[event] is always a function
            aData.on[event].push(on[event]) // 存在的监听器已经转化为数组，所以可以直接push
          } else {
            aData.on[event] = handler // 没有对应监听器则直接添加
          }
        }

        const aAttrs = (a.data.attrs = extend({}, a.data.attrs)) // 浅拷贝attribute对象
        aAttrs.href = href // 将href设置为完整的URL路径.
        aAttrs['aria-current'] = ariaCurrentValue
      } else {
        // doesn't have <a> child, apply listener to self
        data.on = on
      }
    }

    return h(this.tag, data, this.$slots.default) // 返回链接组件的vnode
  }
}

function guardEvent (e) { // 避免各种情况下的重定向
  // don't redirect with control keys
  if (e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) return
  // don't redirect when preventDefault called
  if (e.defaultPrevented) return
  // don't redirect on right click
  if (e.button !== undefined && e.button !== 0) return
  // don't redirect if `target="_blank"`
  if (e.currentTarget && e.currentTarget.getAttribute) {
    const target = e.currentTarget.getAttribute('target')
    if (/\b_blank\b/i.test(target)) return
  }
  // this may be a Weex event which doesn't have this method
  if (e.preventDefault) {
    e.preventDefault()
  }
  return true
}

function findAnchor (children) { // 找到元素内容中的链接元素vnode
  if (children) {
    let child
    for (let i = 0; i < children.length; i++) {
      child = children[i]
      if (child.tag === 'a') {
        return child
      }
      if (child.children && (child = findAnchor(child.children))) {
        return child
      }
    }
  }
}
