import { warn } from '../util/warn'
import { extend } from '../util/misc'

export default {
  name: 'RouterView',
  functional: true,
  props: {
    name: {
      type: String,
      default: 'default'
    }
  },
  render (_, { props, children, parent, data }) {
    // used by devtools to display a router-view badge
    data.routerView = true // 标识router-view组件

    // directly use parent context's createElement() function
    // so that components rendered by router-view can resolve named slots
    const h = parent.$createElement // 复用router-view的父级组件实例上的h方法，这样router-view渲染的组件就能使用传给router-view的插槽内容了
    const name = props.name // 命名视图的名称
    const route = parent.$route // 获取当前路由
    const cache = parent._routerViewCache || (parent._routerViewCache = {})

    // determine current view depth, also check to see if the tree
    // has been toggled inactive but kept-alive.
    let depth = 0 // 标识路由嵌套深度
    let inactive = false
    while (parent && parent._routerRoot !== parent) { // 向上层一直遍历到根组件实例
      const vnodeData = parent.$vnode ? parent.$vnode.data : {}
      if (vnodeData.routerView) { // 标识该层父组件实例也是router-view的视图，则嵌套深度加1
        depth++
      }
      if (vnodeData.keepAlive && parent._directInactive && parent._inactive) { // 父组件某层位于keep-alive组件中且当前处于失活状态
        inactive = true
      }
      parent = parent.$parent // 继续返回到上一层父组件实例
    }
    data.routerViewDepth = depth // 路由视图嵌套深度

    // render previous view if the tree is inactive and kept-alive
    if (inactive) { // 这里的渲染似乎没什么用——因为inactive代表父组件视图当前已被移除
      debugger
      const cachedData = cache[name]
      const cachedComponent = cachedData && cachedData.component
      if (cachedComponent) {
        // #2301
        // pass props
        if (cachedData.configProps) {
          fillPropsinData(cachedComponent, data, cachedData.route, cachedData.configProps)
        }
        return h(cachedComponent, data, children)
      } else {
        // render previous empty view
        return h()
      }
    }

    const matched = route.matched[depth] // 获取对应嵌套层次的匹配路由记录
    const component = matched && matched.components[name] // 根据name从路由记录获取路由组件

    // render empty node if no matched route or no config component
    if (!matched || !component) { // 表示当前是非匹配路由
      cache[name] = null // 缓存置为null
      return h() // 什么都不渲染
    }

    // cache component
    cache[name] = { component } // 缓存组件

    // attach instance registration hook
    // this will be called in the instance's injected lifecycle hooks
    data.registerRouteInstance = (vm, val) => { // 注册组件实例，以便在beforeRouteEnter传给next的回调中使用。初始化时vm和val相同,卸载阶段val为undefined
      // val could be undefined for unregistration
      const current = matched.instances[name] // 当前路由对应的组件实例
      if ( // 当前视图组件实例过期或不存在则赋为val
        (val && current !== vm) ||
        (!val && current === vm)
      ) {
        matched.instances[name] = val
      }
    }

    // also register instance in prepatch hook
    // in case the same component instance is reused across different routes
    ;(data.hook || (data.hook = {})).prepatch = (_, vnode) => {
      matched.instances[name] = vnode.componentInstance // 在router-view视图组件vnode的prepatch hook中注册实例，防止不同路由使用相同的组件实例，
    }

    // register instance in init hook
    // in case kept-alive component be actived when routes changed
    data.hook.init = (vnode) => {
      if (vnode.data.keepAlive &&
        vnode.componentInstance &&
        vnode.componentInstance !== matched.instances[name]
      ) { // 在router-view视图组件vnode的init hook中比对更新组件实例，防止当包裹在keep-alive组件中时因激活状态切换导致组件实例失效
        matched.instances[name] = vnode.componentInstance
      }
    }

    const configProps = matched.props && matched.props[name] // 根据name获取路由携带的props参数,将作为props传递给当前组件实例
    // save route and configProps in cachce
    if (configProps) {
      extend(cache[name], { // 缓存当前路由和配置的props
        route,
        configProps
      })
      fillPropsinData(component, data, route, configProps)
    }

    return h(component, data, children)
  }
}

function fillPropsinData (component, data, route, configProps) { // 填充props和attrs
  // resolve props
  let propsToPass = data.props = resolveProps(route, configProps) // 解析出props
  if (propsToPass) {
    // clone to prevent mutation
    propsToPass = data.props = extend({}, propsToPass) // 将props浅拷贝赋给配置对象
    // pass non-declared props as attrs
    const attrs = data.attrs = data.attrs || {}
    for (const key in propsToPass) {
      if (!component.props || !(key in component.props)) { // 不在组件props配置对象中的属性都保存在配置对象attrs属性中
        attrs[key] = propsToPass[key]
        delete propsToPass[key]
      }
    }
  }
}

function resolveProps (route, config) { // 解析路由携带的props
  switch (typeof config) {
    case 'undefined': // 无效
      return
    case 'object': // 是对象则直接返回
      return config
    case 'function':
      return config(route) // 是函数则返回传入当前路由的执行结果
    case 'boolean': // 为true则使用路径参数作为props
      return config ? route.params : undefined
    default: // 其它类型则无效
      if (process.env.NODE_ENV !== 'production') {
        warn(
          false,
          `props in "${route.path}" is a ${typeof config}, ` +
          `expecting an object, function or boolean.`
        )
      }
  }
}
