/**
 * Get the first item that pass the test
 * by second argument function
 *
 * @param {Array} list
 * @param {Function} f
 * @return {*}
 */
export function find (list, f) {
  return list.filter(f)[0]
}

/**
 * Deep copy the given object considering circular structure.
 * This function caches all nested objects and its copies.
 * If it detects circular structure, use cached copy to avoid infinite loop.
 *
 * @param {*} obj
 * @param {Array<Object>} cache
 * @return {*}
 */
export function deepCopy (obj, cache = []) { // 返回对象的深拷贝，不过返回值是一个纯对象——Object的实例，且只会拷贝属性名为字符串的属性
  // just return if obj is immutable value
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  // if obj is hit, it is in circular structure
  const hit = find(cache, c => c.original === obj)
  if (hit) { // cache数组元素的original属性是对obj所在对象树上某层对象的复制，如果与obj相等说明对象某一层存在循环引用，比如：obj.a = obj; 则返回copy，也就是obj所在对象的拷贝。
    return hit.copy
  }

  const copy = Array.isArray(obj) ? [] : {}
  // put the copy into cache at first
  // because we want to refer it in recursive deepCopy
  cache.push({ // 缓存对象拷贝
    original: obj,
    copy
  })

  Object.keys(obj).forEach(key => { // 遍历构建拷贝对象，对于其中的对象属性也用deepCopy进行深拷贝
    copy[key] = deepCopy(obj[key], cache)
  })

  return copy
}

/**
 * forEach for object
 */
export function forEachValue (obj, fn) { // 遍历对象的属性依次调用回调，回调传入的第一个参数为属性值，第二个参数为属性名
  Object.keys(obj).forEach(key => fn(obj[key], key))
}

export function isObject (obj) {
  return obj !== null && typeof obj === 'object'
}

export function isPromise (val) {
  return val && typeof val.then === 'function'
}

export function assert (condition, msg) { // condition为false——不满足条件则抛出异常
  if (!condition) throw new Error(`[vuex] ${msg}`)
}

export function partial (fn, arg) { // 将参数保存在闭包中，而返回一个无参数的函数
  return function () {
    return fn(arg)
  }
}
