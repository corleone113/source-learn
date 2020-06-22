import applyMixin from './mixin'
import devtoolPlugin from './plugins/devtool'
import ModuleCollection from './module/module-collection'
import { forEachValue, isObject, isPromise, assert, partial } from './util'

let Vue // bind on install // 緩存注冊vuex的Vue

export class Store {
  constructor (options = {}) {
    // Auto install if it is not done yet and `window` has `Vue`.
    // To allow users to avoid auto-installation in some cases,
    // this code should be placed here. See #731
    if (!Vue && typeof window !== 'undefined' && window.Vue) {
      install(window.Vue)
    }

    if (__DEV__) {
      assert(Vue, `must call Vue.use(Vuex) before creating a store instance.`)
      assert(typeof Promise !== 'undefined', `vuex requires a Promise polyfill in this browser.`)
      assert(this instanceof Store, `store must be called with the new operator.`)
    }

    const {
      plugins = [],
      strict = false
    } = options

    // store internal state
    this._committing = false // 控制是否可以进行变更(mutation)的布尔值
    this._actions = Object.create(null) // 存放全局命名空间action数组的对象。
    this._actionSubscribers = [] // 执行动作(通过dispatch执行action)时触发的回调数组，通过subscribeAction方法注册回调。
    this._mutations = Object.create(null) // 存放全局命名空间mutation数组的对象。
    this._wrappedGetters = Object.create(null) // 存放全局命名空间getter数组的对象。
    this._modules = new ModuleCollection(options) // 默认模块树
    this._modulesNamespaceMap = Object.create(null) // 带命名空间的模块的map
    this._subscribers = [] // 状态变更(通过commit执行mutation)时触发的回调数组，通过subscribe方法注册回调。
    this._watcherVM = new Vue() // 注册该store实例的Vue实例(组件)
    this._makeLocalGettersCache = Object.create(null) // 存放命名空间模块的getter对象——每个属性名为模块命名空间名称，而值为存放了该模块声明的getter的对象

    // bind commit and dispatch to self
    const store = this
    const { dispatch, commit } = this
    this.dispatch = function boundDispatch (type, payload) { // 绑定this，保证在没有调用者的情况this也能指向store实例
      return dispatch.call(store, type, payload)
    }
    this.commit = function boundCommit (type, payload, options) { // 也是绑定this实例，目的和上面dispatch一样
      return commit.call(store, type, payload, options)
    }

    // strict mode
    this.strict = strict

    const state = this._modules.root.state // store状态为根模块的状态

    // init root module.
    // this also recursively registers all sub-modules
    // and collects all module getters inside this._wrappedGetters
    installModule(this, state, [], this._modules.root) // 初始化根模块——注册getters、mutations、actions，并递归地对子模块调用这个方法以进行初始化

    // initialize the store vm, which is responsible for the reactivity
    // (also registers _wrappedGetters as computed properties)
    resetStoreVM(this, state) // 初始化/重置store的内部Vue实例——会新增/重置store._vm

    // apply plugins
    plugins.forEach(plugin => plugin(this)) // plugin是一个以当前store作为参数的函数

    const useDevtools = options.devtools !== undefined ? options.devtools : Vue.config.devtools
    if (useDevtools) { // 如果支持devtool钩子则绑定钩子事件和订阅变更(commit)和动作(dispatch)。
      devtoolPlugin(this)
    }
  }

  get state () { // 从store内部Vue实例上获取根状态——这个状态为根模块上的状态，即当前store的状态树
    return this._vm._data.$$state
  }

  set state (v) { // 禁止直接修改store.state
    if (__DEV__) {
      assert(false, `use store.replaceState() to explicit replace store state.`)
    }
  }

  commit (_type, _payload, _options) { // 提交变更并调用回调
    // check object-style commit
    const {
      type,
      payload,
      options
    } = unifyObjectStyle(_type, _payload, _options) // 参数统一化处理。

    const mutation = { type, payload } // 传入回调的第一个参数，type为mutation方法名， payload为负载对象
    const entry = this._mutations[type] // 获取type对应的mutation方法数组
    if (!entry) {
      if (__DEV__) {
        console.error(`[vuex] unknown mutation type: ${type}`)
      }
      return
    }
    this._withCommit(() => {
      entry.forEach(function commitIterator (handler) { // 遍历mutation方法数组依次执行各个mutation方法——mutation数组保存不同模块中同名mutation方法，所以一个模块的mutation方法执行时也会导致其它模块中同名mutation方法的执行。
        handler(payload)
      })
    })

    this._subscribers
      .slice() // 对_subscribers进行浅拷贝避免消费者调用unsubscribe方法引起BUG——迭代器失效。
      .forEach(sub => sub(mutation, this.state)) // 依次执行订阅的回调

    if (
      __DEV__ &&
      options && options.silent
    ) {
      console.warn( // silent选项已经不再支持，使用vue-devtools中的filter功能作为替代。
        `[vuex] mutation type: ${type}. Silent option has been removed. ` +
        'Use the filter functionality in the vue-devtools'
      )
    }
  }

  dispatch (_type, _payload) { // 提交动作并调用action回调
    // check object-style dispatch
    const {
      type,
      payload
    } = unifyObjectStyle(_type, _payload) // 参数统一化处理。

    const action = { type, payload } // 传入回调的对象——type表示action类型，payload则为负载对象
    const entry = this._actions[type]
    if (!entry) { // 未知的动作类型
      if (__DEV__) {
        console.error(`[vuex] unknown action type: ${type}`)
      }
      return
    }

    try {
      this._actionSubscribers
        .slice() // shallow copy to prevent iterator invalidation if subscriber synchronously calls unsubscribe
        .filter(sub => sub.before) // 先执行订阅上的before方法，所以要过滤掉没有before的订阅
        .forEach(sub => sub.before(action, this.state)) // 执行before方法时会传入action(动作)和当前状态。
    } catch (e) {
      if (__DEV__) {
        console.warn(`[vuex] error in before action subscribers: `)
        console.error(e)
      }
    }

    const result = entry.length > 1 // 遍历该action类型对应的action方法数组并执行action方法, 这里的actioin方法是封装过thunk版本,且返回promise
      ? Promise.all(entry.map(handler => handler(payload)))
      : entry[0](payload)

    return new Promise((resolve, reject) => { // 最终返回一个promise, promise的状态由result的状态决定
      result.then(res => { // action执行成功时遍历执行订阅的after方法
        try {
          this._actionSubscribers
            .filter(sub => sub.after)
            .forEach(sub => sub.after(action, this.state))
        } catch (e) {
          if (__DEV__) {
            console.warn(`[vuex] error in after action subscribers: `)
            console.error(e)
          }
        }
        resolve(res) // 将result结果作为返回的promise的内部value
      }, error => { // action执行失败时遍历执行订阅的error方法
        try {
          this._actionSubscribers
            .filter(sub => sub.error)
            .forEach(sub => sub.error(action, this.state, error))
        } catch (e) {
          if (__DEV__) {
            console.warn(`[vuex] error in error action subscribers: `)
            console.error(e)
          }
        }
        reject(error) // 将result失败的原因作为返回的promise的失败原因
      })
    })
  }

  subscribe (fn, options) { // 订阅状态变更(commit mutation)的回调
    return genericSubscribe(fn, this._subscribers, options)
  }

  subscribeAction (fn, options) { // 订阅动作派发(dispatch action)
    const subs = typeof fn === 'function' ? { before: fn } : fn // 订阅应该是一个对象，如果是函数则将其作为一个订阅对象的before方法。
    return genericSubscribe(subs, this._actionSubscribers, options)
  }

  watch (getter, cb, options) { // 观测一个全局命名空间下的getter
    if (__DEV__) {
      assert(typeof getter === 'function', `store.watch only accepts a function.`)
    }
    return this._watcherVM.$watch(() => getter(this.state, this.getters), cb, options)
  }

  replaceState (state) { // 替换内部Vue实例的state
    this._withCommit(() => {
      this._vm._data.$$state = state
    })
  }

  registerModule (path, rawModule, options = {}) { // 根据键路径注册模块到store模块树(根模块)中
    if (typeof path === 'string') path = [path]

    if (__DEV__) {
      assert(Array.isArray(path), `module path must be a string or an Array.`)
      assert(path.length > 0, 'cannot register the root module by using registerModule.')
    }

    this._modules.register(path, rawModule) // 先注册到根模块中
    installModule(this, this.state, path, this._modules.get(path), options.preserveState) // 重新初始化模块树
    // reset store to update getters...
    resetStoreVM(this, this.state) // 重置内部Vue实例
  }

  unregisterModule (path) { // 注销键路径对应的模块
    if (typeof path === 'string') path = [path]

    if (__DEV__) {
      assert(Array.isArray(path), `module path must be a string or an Array.`)
    }

    this._modules.unregister(path)
    this._withCommit(() => { // 从状态树中删除模块对应的状态
      const parentState = getNestedState(this.state, path.slice(0, -1))
      Vue.delete(parentState, path[path.length - 1])
    })
    resetStore(this)
  }

  hasModule (path) { // 判断键路径数组对应的模块是否注册过
    if (typeof path === 'string') path = [path]

    if (__DEV__) {
      assert(Array.isArray(path), `module path must be a string or an Array.`)
    }

    return this._modules.isRegistered(path)
  }

  hotUpdate (newOptions) { // 热更新store——先更新模块的getters,mutations,actions；然后重置store
    this._modules.update(newOptions)
    resetStore(this, true)
  }

  _withCommit (fn) { // 执行回调(fn)期间一定能进行变更
    const committing = this._committing // 缓存committing属性
    this._committing = true // 不管之前能否变更，执行fn期间一定可以变更状态(state)
    fn()
    this._committing = committing // fn执行结束恢复committing之前的值。
  }
}

function genericSubscribe (fn, subs, options) { // 注册订阅
  if (subs.indexOf(fn) < 0) { // 没有重复订阅则进行注册
    options && options.prepend // options.prepend为true则注册到头部
      ? subs.unshift(fn)
      : subs.push(fn)
  }
  return () => {
    const i = subs.indexOf(fn)
    if (i > -1) {
      subs.splice(i, 1)
    }
  }
}

function resetStore (store, hot) { // 重置store——重新初始化_actions,_mutations,_wrappedGetters,_modulesNamespaceMap
  store._actions = Object.create(null)
  store._mutations = Object.create(null)
  store._wrappedGetters = Object.create(null)
  store._modulesNamespaceMap = Object.create(null)
  const state = store.state
  // init all modules
  installModule(store, state, [], store._modules.root, true)
  // reset vm
  resetStoreVM(store, state, hot)
}

function resetStoreVM (store, state, hot) { // 初始化/重置store得Vue实例对象。使用Vue实例是为了使用响应式更新等特性。
  const oldVm = store._vm // 获取旧得store Vue实例。

  // bind store public getters
  store.getters = {} // 初始化getters对象——getters对象得属性值为getter方法计算后的值，是数据属性
  // reset local getters cache
  store._makeLocalGettersCache = Object.create(null) // 重置_makeLocalettersCache对象
  const wrappedGetters = store._wrappedGetters // 获取封装getters对象
  const computed = {}
  forEachValue(wrappedGetters, (fn, key) => {
    // use computed to leverage its lazy-caching mechanism
    // direct inline function use will lead to closure preserving oldVm.
    // using partial to return function with only arguments preserved in closure environment.
    computed[key] = partial(fn, store) // 通过partial将函数的参数存放在闭包中，得到一个等效的无参数函数，保存为computed上getter同名的方法
    Object.defineProperty(store.getters, key, {
      get: () => store._vm[key], // 取_vm(旧的内部Vue实例)上的与getter同名的计算属性存放到getters对象上
      enumerable: true // for local getters
    })
  })

  // use a Vue instance to store the state tree
  // suppress warnings just in case the user has added
  // some funky global mixins
  const silent = Vue.config.silent
  Vue.config.silent = true // 创建存放状态树的Vue实例期间禁用所有日志和警告
  store._vm = new Vue({
    data: {
      $$state: state // 注册store的组件真正引用的state在这里，它保存在一个Vue实例的数据属性上，所以才能响应式更新。
    },
    computed // 用上面得到computed对象作为计算属性配置对象
  })
  Vue.config.silent = silent // 恢复全局的silent配置

  // enable strict mode for new vm
  if (store.strict) { // 如果strict为true则开启严格模式
    enableStrictMode(store)
  }

  if (oldVm) { // 如果旧的内部Vue实例存在且当前处于热更新模式则清除state状态
    if (hot) {
      // dispatch changes in all subscribed watchers
      // to force getter re-evaluation for hot reloading.
      store._withCommit(() => {
        oldVm._data.$$state = null
      })
    }
    Vue.nextTick(() => oldVm.$destroy()) // 销毁旧的内部Vue实例
  }
}

function installModule (store, rootState, path, module, hot) { // 参数path为当前模块(对应传入的参数module)的键路径数组——比如root.moduleA.moduleAA的键路径数组就是['moduleA','moduleAA']
  const isRoot = !path.length
  const namespace = store._modules.getNamespace(path) // 获取当前模块(参数module)的名称空间，未使用名称空间则得到空字符串

  // register in namespace map
  if (module.namespaced) {
    if (store._modulesNamespaceMap[namespace] && __DEV__) { // 当前模块已经在_modulesNamespaceMap中注册过了
      console.error(`[vuex] duplicate namespace ${namespace} for the namespaced module ${path.join('/')}`)
    }
    store._modulesNamespaceMap[namespace] = module // 将当前模块注册/覆盖到_modulesNamespaceMap中
  }

  // set state
  if (!isRoot && !hot) { // 若当前模块不是根模块且非热更新状态则在状态树中附加当前模块的状态
    const parentState = getNestedState(rootState, path.slice(0, -1)) // path除开最后一个键组成键字符串(. 连接)即为当前模块父级模块的键路径。通过这个键路径访问根state就能得到父模块的state了。
    const moduleName = path[path.length - 1] // path数组最后一个键即为当前模块(参数module)的名称
    store._withCommit(() => {
      if (__DEV__) {
        if (moduleName in parentState) { // 状态树中状态字段被同名覆盖。
          console.warn(
            `[vuex] state field "${moduleName}" was overridden by a module with the same name at "${path.join('.')}"`
          )
        }
      }
      Vue.set(parentState, moduleName, module.state) // 附加当前的模块的状态到响应式状态树中去, 也可以改成下面的写法， 这里不是响应式更新的关键
      // parentState[moduleName] = module.state;
    })
  }

  const local = module.context = makeLocalContext(store, namespace, path)

  module.forEachMutation((mutation, key) => { // 注册mutaions选项中各个mutation
    const namespacedType = namespace + key
    registerMutation(store, namespacedType, mutation, local)
  })

  module.forEachAction((action, key) => { // 注册actions选项中各个action
    const type = action.root ? key : namespace + key // action.root为true则action注册到全局命名空间中
    const handler = action.handler || action
    registerAction(store, type, handler, local)
  })

  module.forEachGetter((getter, key) => { // 注册getters选项中各个getter方法
    const namespacedType = namespace + key
    registerGetter(store, namespacedType, getter, local)
  })

  module.forEachChild((child, key) => { // 对子模块递归调用此方法完成子模块的初始化
    installModule(store, rootState, path.concat(key), child, hot)
  })
}

/**
 * make localized dispatch, commit, getters and state
 * if there is no namespace, just use root ones
 */
function makeLocalContext (store, namespace, path) {
  const noNamespace = namespace === ''

  const local = {
    dispatch: noNamespace ? store.dispatch : (_type, _payload, _options) => { // 为该模块的context确定dispatch版本
      const args = unifyObjectStyle(_type, _payload, _options)
      const { payload, options } = args
      let { type } = args

      if (!options || !options.root) { // 如果options.root为false则加上命名空间前缀(形式为'xxx/')
        type = namespace + type
        if (__DEV__ && !store._actions[type]) {
          console.error(`[vuex] unknown local action type: ${args.type}, global type: ${type}`)
          return
        }
      }

      return store.dispatch(type, payload)
    },

    commit: noNamespace ? store.commit : (_type, _payload, _options) => {// 为该模块的context确定commit版本
      const args = unifyObjectStyle(_type, _payload, _options)
      const { payload, options } = args
      let { type } = args

      if (!options || !options.root) { // 如果没有通过选项对象显式指定访问全局命名空间下的action就加上命名空间前缀(形式为'xxx/')
        type = namespace + type
        if (__DEV__ && !store._mutations[type]) {
          console.error(`[vuex] unknown local mutation type: ${args.type}, global type: ${type}`)
          return
        }
      }

      store.commit(type, payload, options)
    }
  }

  // getters and state object must be gotten lazily // state和getters的定义必须是惰性的(定义为getter属性)，因为它们都依赖于state，而state 随时可能更新
  // because they will be changed by vm update
  Object.defineProperties(local, {
    getters: {
      get: noNamespace // 根据是否支持命名空间决定getter对象版本
        ? () => store.getters // 全局命名空间getter对象
        : () => makeLocalGetters(store, namespace)
    },
    state: {
      get: () => getNestedState(store.state, path) // 根据键路径数组取到当前模块的状态
    }
  })

  return local
}

function makeLocalGetters (store, namespace) { // 返回命名空间模块的getter对象。
  if (!store._makeLocalGettersCache[namespace]) { // 如果_makeLocalGettersCache中还没有对应命名空间getter对象的缓存则生成对应对象并存入其中
    const gettersProxy = {}
    const splitPos = namespace.length
    Object.keys(store.getters).forEach(type => { // getters中包含命名空间模块和非命名空间模块的getter，对于命名空间模块其getter名称就是 'xxx/xxx'
      // skip if the target getter is not match this namespace
      if (type.slice(0, splitPos) !== namespace) return // slice(0, splitPos)取出type中命名空间部分——即 'xxx/' 这部分， 不匹配则跳过

      // extract local getter type
      const localType = type.slice(splitPos) // localType为type中除去命名空间名称部分的值

      // Add a port to the getters proxy.
      // Define as getter property because
      // we do not want to evaluate the getters in this time.
      Object.defineProperty(gettersProxy, localType, { // 定义getter对象
        get: () => store.getters[type],
        enumerable: true
      })
    })
    store._makeLocalGettersCache[namespace] = gettersProxy // 将含有对应getter的对象存放在_makeLocalGettersCache中
  }

  return store._makeLocalGettersCache[namespace]
}

function registerMutation (store, type, handler, local) { // 注册mutation方法到_mutations对象中名称对应的数组中
  const entry = store._mutations[type] || (store._mutations[type] = [])
  entry.push(function wrappedMutationHandler (payload) { // 将mutation方法封装为thunk版本。
    handler.call(store, local.state, payload) // 第一个参数是模块context中的state
  })
}

function registerAction (store, type, handler, local) { // 注册action方法到_actions对象中名称对应的数组中
  const entry = store._actions[type] || (store._actions[type] = [])
  entry.push(function wrappedActionHandler (payload) { // 将action方法封装为返回promise的thunk版本。
    let res = handler.call(store, { // 第一个参数是模块context中所有属性外加根getter和根state组成的对象(context)
      dispatch: local.dispatch,
      commit: local.commit,
      getters: local.getters,
      state: local.state,
      rootGetters: store.getters,
      rootState: store.state
    }, payload)
    if (!isPromise(res)) { // 不是promise则转化为promise
      res = Promise.resolve(res)
    }
    if (store._devtoolHook) { // _devtoolHook存在则说明支持vue-devtools
      return res.catch(err => { // 捕获到错误时触发vue-devtools钩子中的错误事件
        store._devtoolHook.emit('vuex:error', err)
        throw err
      })
    } else {
      return res // 没有发生错误则返回promise结果
    }
  })
}

function registerGetter (store, type, rawGetter, local) { // 注册getter方法到_wrappedGetters对象中
  if (store._wrappedGetters[type]) { // getter方法注册到_wrappedGetters对象中时是作为方法保存而不是存放到数组中，非命名空间模块的getter不应该重名
    if (__DEV__) { // 开发模式下报错
      console.error(`[vuex] duplicate getter key: ${type}`)
    }
    return
  }
  store._wrappedGetters[type] = function wrappedGetter (store) { // 存放到_wrappedGetters中的getter是封装过后的接受store为参数thunk版本
    return rawGetter( // getter方法会收到四个参数
      local.state, // local state // 模块自身的(context下)的state
      local.getters, // local getters // 模块自身的getters对象
      store.state, // root state // 根state
      store.getters // root getters // 根getters对象
    )
  }
}

function enableStrictMode (store) { // 开启严格模式——进至mutation之外的状态变更操作。
  store._vm.$watch(function () { return this._data.$$state }, () => {
    if (__DEV__) {
      assert(store._committing, `do not mutate vuex store state outside mutation handlers.`)
    }
  }, { deep: true, sync: true })
}

function getNestedState (state, path) { // 根据键路径数组查询对应模块的state
  return path.reduce((state, key) => state[key], state)
}

function unifyObjectStyle (type, payload, options) { // 针对第一个参数为对象的类型进行额外处理，保证三个参数的类型的统一性。
  if (isObject(type) && type.type) { // 第一个参数如果是对象且带type属性，那么它将作为payload(负载),它的type作为type(动作类型)，第二个参数作为选项对象。
    options = payload
    payload = type
    type = type.type
  }

  if (__DEV__) { // type只支持字符串类型
    assert(typeof type === 'string', `expects string as the type, but found ${typeof type}.`)
  }

  return { type, payload, options }
}

export function install (_Vue) {
  if (Vue && _Vue === Vue) { // 如果已经注册过Vuex插件则跳过
    if (__DEV__) {
      console.error(
        '[vuex] already installed. Vue.use(Vuex) should be called only once.'
      )
    }
    return
  }
  Vue = _Vue // 缓存Vue库
  applyMixin(Vue)
}
