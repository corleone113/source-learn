import Module from './module'
import { assert, forEachValue } from '../util'

export default class ModuleCollection {
  constructor (rawRootModule) { // rawRootModule就是传入Store构造函数的选项对象(options)
    // register root module (Vuex.Store options)
    this.register([], rawRootModule, false)
  }

  get (path) { // 根据键路径数组获取当前模块树上指定的模块
    return path.reduce((module, key) => {
      return module.getChild(key)
    }, this.root)
  }

  getNamespace (path) { // 获取path(键路径数组)匹配的模块的命名空间名称，如果该模块使用了命名空间(namespaced为true)那么返回值格式为'xxx/'，否则返回空字符串。
    let module = this.root
    return path.reduce((namespace, key) => {
      module = module.getChild(key)
      return namespace + (module.namespaced ? key + '/' : '')
    }, '')
  }

  update (rawRootModule) { // 递归地更新根模块(更新其内部模块选项对象的namespaced、getters、mutations、actions等属性)
    update([], this.root, rawRootModule)
  }

  register (path, rawModule, runtime = true) { // path为模块的键路径(模块支持嵌套)分割'.'后除开'root'后得到的数组，比如：'root.parent.son'对应path数组就是['parent','son']。path数组构建的遍历过程是层序遍历的
    if (__DEV__) {
      assertRawModule(path, rawModule)
    }

    const newModule = new Module(rawModule, runtime)
    if (path.length === 0) {
      this.root = newModule
    } else { // path.length>0说明存在嵌套模块(存在store.modules)。
      const parent = this.get(path.slice(0, -1)) // 根据path获取当前模块(newModule)的父模块，这里用slice取到最后一个键之前的键从而构成获取父模块的键路径数组。
      parent.addChild(path[path.length - 1], newModule) // 在父模块上添加当前模块为子模块。
    }

    // register nested modules
    if (rawModule.modules) { // 注册嵌套模块
      forEachValue(rawModule.modules, (rawChildModule, key) => {
        this.register(path.concat(key), rawChildModule, runtime)
      })
    }
  }

  unregister (path) { // 根据键路径从当前模块树上注销对应的模块
    const parent = this.get(path.slice(0, -1))
    const key = path[path.length - 1]
    if (!parent.getChild(key).runtime) return // runtime为false则不会注销该模块

    parent.removeChild(key)
  }

  isRegistered (path) { // 判断键路径数组对应的模块是否已经注册在当前模块树中
    const parent = this.get(path.slice(0, -1))
    const key = path[path.length - 1]

    return parent.hasChild(key)
  }
}

function update (path, targetModule, newModule) {
  if (__DEV__) {
    assertRawModule(path, newModule)
  }

  // update target module
  targetModule.update(newModule) // 更新模块(更新其内部缓存的模块选项对象)

  // update nested modules
  if (newModule.modules) {
    for (const key in newModule.modules) {
      if (!targetModule.getChild(key)) { // 新增的嵌套模块需要手动刷新才添加进来
        if (__DEV__) {
          console.warn(
            `[vuex] trying to add a new module '${key}' on hot reloading, ` +
            'manual reload is needed'
          )
        }
        return
      }
      update( // 更新嵌套模块(更新其内部缓存的模块选项对象)。
        path.concat(key),
        targetModule.getChild(key),
        newModule.modules[key]
      )
    }
  }
}

const functionAssert = {
  assert: value => typeof value === 'function',
  expected: 'function'
}

const objectAssert = {
  assert: value => typeof value === 'function' ||
    (typeof value === 'object' && typeof value.handler === 'function'),
  expected: 'function or object with "handler" function'
}

const assertTypes = { // 校验器对象，用于校验getters/mutations/actions
  getters: functionAssert,
  mutations: functionAssert,
  actions: objectAssert
}

function assertRawModule (path, rawModule) { // 校验传入的模块配置对象中的getters/mutations/actions属性
  Object.keys(assertTypes).forEach(key => {
    if (!rawModule[key]) return

    const assertOptions = assertTypes[key]

    forEachValue(rawModule[key], (value, type) => {
      assert(
        assertOptions.assert(value),
        makeAssertionMessage(path, key, type, value, assertOptions.expected)
      )
    })
  })
}

function makeAssertionMessage (path, key, type, value, expected) { // 用于选项对象的getters/mutations/actions不符合规则时抛出错误。
  let buf = `${key} should be ${expected} but "${key}.${type}"`
  if (path.length > 0) {
    buf += ` in module "${path.join('.')}"`
  }
  buf += ` is ${JSON.stringify(value)}.`
  return buf
}
