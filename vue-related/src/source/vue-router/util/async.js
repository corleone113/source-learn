/* @flow */

export function runQueue (queue: Array<?NavigationGuard>, fn: Function, cb: Function) { // 路由守卫队列执行器
  const step = index => {
    if (index >= queue.length) { // 遍历结束则执行cb回调
      cb()
    } else {
      if (queue[index]) { // 如果当前遍历的成员不为undefined(那么肯定是守卫)则继续通过fn来执行守卫回调
        fn(queue[index], () => {
          step(index + 1)
        })
      } else { // 当前遍历成员无效则跳过
        step(index + 1)
      }
    }
  }
  step(0)
}
