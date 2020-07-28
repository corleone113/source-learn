// Credits: borrowed code from fcomb/redux-logger

import { deepCopy } from '../util'

export default function createLogger ({
  collapsed = true,
  filter = (mutation, stateBefore, stateAfter) => true, // 状态变更过滤器
  transformer = state => state, // 状态转换器
  mutationTransformer = mut => mut, // mutation转换器
  actionFilter = (action, state) => true, // action派发过滤器
  actionTransformer = act => act, // action转换器
  logMutations = true,
  logActions = true,
  logger = console
} = {}) {
  return store => {
    let prevState = deepCopy(store.state) // 初始化旧状态，是对根状态的深拷贝

    if (typeof logger === 'undefined') {
      return
    }

    if (logMutations) { // 是否打印状态变更过程
      store.subscribe((mutation, state) => {
        const nextState = deepCopy(state)

        if (filter(mutation, prevState, nextState)) { // 过滤变更——符合条件的状态变更才会进行日志记录
          const formattedTime = getFormattedTime() // `@ hh:mm:ss.sss` 格式的当前时间
          const formattedMutation = mutationTransformer(mutation) // 对mutation进行转换，默认不转换
          const message = `mutation ${mutation.type}${formattedTime}` // 日志打印状态变更监控信息的开头部分

          startMessage(logger, message, collapsed) // 以下信息可折叠
          logger.log('%c prev state', 'color: #9E9E9E; font-weight: bold', transformer(prevState)) // 打印变更之前的状态信息
          logger.log('%c mutation', 'color: #03A9F4; font-weight: bold', formattedMutation) // 打印变更动作信息
          logger.log('%c next state', 'color: #4CAF50; font-weight: bold', transformer(nextState)) // 打印变更之后的状态信息
          endMessage(logger) // 信息折叠结束
        }

        prevState = nextState // 打印结束更新旧状态。
      })
    }

    if (logActions) { // 是否打印副作用动作
      store.subscribeAction((action, state) => {
        if (actionFilter(action, state)) {
          const formattedTime = getFormattedTime() // `@ hh:mm:ss.sss` 格式的当前时间
          const formattedAction = actionTransformer(action) // 对action进行转换， 默认不转换
          const message = `action ${action.type}${formattedTime}` // 日志打印动作变更监控信息的开头部分

          startMessage(logger, message, collapsed) // 信息开始折叠
          logger.log('%c action', 'color: #03A9F4; font-weight: bold', formattedAction)
          endMessage(logger) // 结束折叠。
        }
      })
    }
  }
}

function startMessage (logger, message, collapsed) { // 打印可折叠的日志信息
  const startMessage = collapsed
    ? logger.groupCollapsed // 默认折叠起来
    : logger.group // 默认展开

  // render
  try {
    startMessage.call(logger, message)
  } catch (e) {
    logger.log(message)
  }
}

function endMessage (logger) { // 打印折叠信息的结束位置
  try {
    logger.groupEnd()
  } catch (e) {
    logger.log('—— log end ——')
  }
}

function getFormattedTime () { // 得到当前时间的 `@ hh:mm:ss.sss` 格式的值
  const time = new Date()
  return ` @ ${pad(time.getHours(), 2)}:${pad(time.getMinutes(), 2)}:${pad(time.getSeconds(), 2)}.${pad(time.getMilliseconds(), 3)}`
}

function repeat (str, times) { // 返回times个str拼接起来的字符串
  return (new Array(times + 1)).join(str)
}

function pad (num, maxLength) { // maxLength指定位数的数字的字符串，位数不足则在头部补0，比如：pad(34, 3) 的结果为 '034'
  return repeat('0', maxLength - num.toString().length) + num
}
