const target = typeof window !== 'undefined'
  ? window
  : typeof global !== 'undefined'
    ? global
    : {}
const devtoolHook = target.__VUE_DEVTOOLS_GLOBAL_HOOK__

export default function devtoolPlugin (store) {
  if (!devtoolHook) return

  store._devtoolHook = devtoolHook

  devtoolHook.emit('vuex:init', store) // 初始化devtools插件的store

  devtoolHook.on('vuex:travel-to-state', targetState => { // devtools插件变更state时同步store中的state。
    store.replaceState(targetState)
  })

  store.subscribe((mutation, state) => { // 订阅状态变更
    devtoolHook.emit('vuex:mutation', mutation, state)
  }, { prepend: true })

  store.subscribeAction((action, state) => { // 订阅副作用动作
    devtoolHook.emit('vuex:action', action, state)
  }, { prepend: true })
}
