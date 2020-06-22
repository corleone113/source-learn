export function extend (a, b) { // 对象a继承b中可枚举属性 浅拷贝
  for (const key in b) {
    a[key] = b[key]
  }
  return a
}
