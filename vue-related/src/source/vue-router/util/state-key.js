/* @flow */
import { inBrowser } from './dom'

// use User Timing api (if present) for more accurate key precision
const Time =
  inBrowser && window.performance && window.performance.now
    ? window.performance
    : Date

export function genStateKey (): string {
  return Time.now().toFixed(3) // 页面文档被创建或导航开始到此时的时间戳或Unix时间戳
}

let _key: string = genStateKey()

export function getStateKey () { // 返回时间戳key
  return _key
}

export function setStateKey (key: string) {
  return (_key = key)
}
