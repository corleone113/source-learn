/* @flow */

import { warn } from './warn'

const encodeReserveRE = /[!'()*]/g
const encodeReserveReplacer = c => '%' + c.charCodeAt(0).toString(16)
const commaRE = /%2C/g

// fixed encodeURIComponent which is more conformant to RFC3986:
// - escapes [!'()*]
// - preserve commas
const encode = str => encodeURIComponent(str)
  .replace(encodeReserveRE, encodeReserveReplacer) // 对 ! ' ( ) * 进行转码
  .replace(commaRE, ',') // 对逗号进行还原

const decode = decodeURIComponent

export function resolveQuery ( // 基于查询字符串和额外查询参数对象解析出查询参数对象
  query: ?string,
  extraQuery: Dictionary<string> = {},
  _parseQuery: ?Function
): Dictionary<string> {
  const parse = _parseQuery || parseQuery
  let parsedQuery
  try {
    parsedQuery = parse(query || '') // 将查询字符串解析为对象形式
  } catch (e) {
    process.env.NODE_ENV !== 'production' && warn(false, e.message)
    parsedQuery = {}
  }
  for (const key in extraQuery) { // 合并额外的查询参数对象
    const value = extraQuery[key]
    parsedQuery[key] = Array.isArray(value) ? value.map(v => '' + v) : '' + value
  }
  return parsedQuery
}

function parseQuery (query: string): Dictionary<string> { // 将查询字符串转化为对象形式
  const res = {}

  query = query.trim().replace(/^(\?|#|&)/, '') // 去掉前置的 ? # &

  if (!query) { // 空字串则直接返回空对象
    return res
  }

  query.split('&').forEach(param => {
    const parts = param.replace(/\+/g, ' ').split('=') // + 替换为空格，然后分割出键和值
    const key = decode(parts.shift()) // 获取查询参数名称，同时进行解码
    const val = parts.length > 0
      ? decode(parts.join('=')) // 获取查询参数值并进行编码，这里加入防卫代码应对参数值含有等号的情况，
      : null

    if (res[key] === undefined) {
      res[key] = val
    } else if (Array.isArray(res[key])) { // 该参数为数组
      res[key].push(val)
    } else { // 多个同名参数则保存为数组
      res[key] = [res[key], val]
    }
  })

  return res
}

export function stringifyQuery (obj: Dictionary<string>): string { // 将查询参数对象转化为字符串形式
  const res = obj ? Object.keys(obj).map(key => {
    const val = obj[key]

    if (val === undefined) {
      return ''
    }

    if (val === null) {
      return encode(key)
    }

    if (Array.isArray(val)) { // 值为数组则单独处理
      const result = []
      val.forEach(val2 => {
        if (val2 === undefined) {
          return
        }
        if (val2 === null) {
          result.push(encode(key))
        } else {
          result.push(encode(key) + '=' + encode(val2))
        }
      })
      return result.join('&')
    }

    return encode(key) + '=' + encode(val)
  }).filter(x => x.length > 0).join('&') : null
  return res ? `?${res}` : ''
}
