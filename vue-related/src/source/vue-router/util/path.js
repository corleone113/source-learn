/* @flow */

export function resolvePath ( // 根据相对路径、基路径 解析出绝对路径。
  relative: string,
  base: string,
  append?: boolean
): string {
  const firstChar = relative.charAt(0)
  if (firstChar === '/') { // 以斜杠开头说明relative不是相对路径，则直接返回
    return relative
  }

  if (firstChar === '?' || firstChar === '#') { // 是'?'或'#'开头则与传入的基路径拼接起来再返回
    return base + relative
  }

  const stack = base.split('/') // 基路径以斜杠为间隔生成一个片段数组stack

  // remove trailing segment if:
  // - not appending
  // - appending to trailing slash (last segment is empty)
  if (!append || !stack[stack.length - 1]) { // append(来自router-link的append属性，表示附加模式)为false或base以'/'结尾则删除statck最后一个元素——相当于去掉base末尾斜杠后面的部分。
    stack.pop()
  }

  // resolve relative path // 这里relative去掉头部斜杠是没必要，因为如果是斜杠开头则已经在上面返回
  const segments = relative.replace(/^\//, '').split('/') // 将相对路径也以斜杠为分隔符生成一个片段数组
  for (let i = 0; i < segments.length; i++) { // 遍历此数组与基路径的片段数组拼接起来
    const segment = segments[i]
    if (segment === '..') { // 表示要返回上一层
      stack.pop()
    } else if (segment !== '.') {
      stack.push(segment)
    }
  }

  // ensure leading slash
  if (stack[0] !== '') { // 保证返回的路径是绝对路径——斜杠开头
    stack.unshift('')
  }

  return stack.join('/')
}

export function parsePath (path: string): { // 将路径字符串分割为path,query,hash三部分，需要注意的是这里的hash是指hash片段，对于hash模式的路径，比如/#/some?id=343 实际上的传入这里的path是/some?id=343，而/#是会被去掉的。
  path: string;
  query: string;
  hash: string;
} {
  let hash = ''
  let query = ''

  const hashIndex = path.indexOf('#')
  if (hashIndex >= 0) { // 存在hash片段则进行分割——hash片段位于末尾，所以先分割出hash字串。
    hash = path.slice(hashIndex) // 包含sharp符号
    path = path.slice(0, hashIndex) // path被修改，去掉了hash部分
  }

  const queryIndex = path.indexOf('?')
  if (queryIndex >= 0) { // 存在查询字串则进行分割
    query = path.slice(queryIndex + 1) // 不包含问号
    path = path.slice(0, queryIndex) // path再次被修改，去掉了查询字符串部分
  }
  return {
    path,
    query,
    hash
  }
}

export function cleanPath (path: string): string { // 将双斜杠替换为单斜杠
  return path.replace(/\/\//g, '/')
}
