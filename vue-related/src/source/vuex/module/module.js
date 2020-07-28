import { forEachValue } from '../util'

// Base data struct for store's module, package with some attribute and method
export default class Module {
  constructor (rawModule, runtime) {
    this.runtime = runtime // 为false表示不能注销(通过ModuleCollection实例的unregister方法注销模块)，否则表示可注销
    // Store some children item
    this._children = Object.create(null) // 缓存子模块的映射表——key到子模块的映射表
    // Store the origin module object which passed by programmer
    this._rawModule = rawModule // 缓存模块选项对象
    const rawState = rawModule.state

    // Store the origin module's state
    this.state = (typeof rawState === 'function' ? rawState() : rawState) || {}
  }

  get namespaced () { // getter属性，表示当前模块是否有独立的命名空间
    return !!this._rawModule.namespaced
  }

  addChild (key, module) { // 添加子模块
    this._children[key] = module
  }

  removeChild (key) { // 移除子模块
    delete this._children[key]
  }

  getChild (key) { // 获取子模块
    return this._children[key]
  }

  hasChild (key) { // 判断是否含有指定子模块
    return key in this._children
  }

  update (rawModule) { // 更新缓存的模块选项对象的namespaced、actions、mutations、getters等属性
    this._rawModule.namespaced = rawModule.namespaced
    if (rawModule.actions) {
      this._rawModule.actions = rawModule.actions
    }
    if (rawModule.mutations) {
      this._rawModule.mutations = rawModule.mutations
    }
    if (rawModule.getters) {
      this._rawModule.getters = rawModule.getters
    }
  }
  // forEachValue遍历的是Object.keys(xxx)，所以下面_children,_rawModule.getters/actions/mutations的属性名不能是Symbol
  forEachChild (fn) {
    forEachValue(this._children, fn)
  }

  forEachGetter (fn) {
    if (this._rawModule.getters) {
      forEachValue(this._rawModule.getters, fn)
    }
  }

  forEachAction (fn) {
    if (this._rawModule.actions) {
      forEachValue(this._rawModule.actions, fn)
    }
  }

  forEachMutation (fn) {
    if (this._rawModule.mutations) {
      forEachValue(this._rawModule.mutations, fn)
    }
  }
}
