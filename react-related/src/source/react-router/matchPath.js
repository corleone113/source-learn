import pathToRegexp from "path-to-regexp";

const cache = {}; // 基于配置选项缓存pathCache的映射表，pathCache是缓存对应pathToRegexp生成结果的映射表
const cacheLimit = 10000; // pathCache最大缓存量为10000个
let cacheCount = 0;

function compilePath(path, options) { // 根据规则字符串和选项对象获取规则结果
  const cacheKey = `${options.end}${options.strict}${options.sensitive}`; // cache的键由配置对象的end、strict、sensitive等属性值组成
  const pathCache = cache[cacheKey] || (cache[cacheKey] = {}); // 基于配置选项获取pathCache映射表，若不存在对应的pathCache则初始化为空对象。

  if (pathCache[path]) return pathCache[path]; // 如果符合path和options的规则结果缓存过则使用缓存

  const keys = [];
  const regexp = pathToRegexp(path, keys, options); // path转化为正则
  const result = { regexp, keys }; // 包含正则和keys(路径参数描述对象数组)的规则结果

  if (cacheCount < cacheLimit) { // 不超过缓存数量上限则继续缓存
    pathCache[path] = result; // 基于path缓存规则结果
    cacheCount++;
  }

  return result;
}

/**
 * Public API for matching a URL pathname to a path.
 */
function matchPath(pathname, options = {}) { // 对URL路径和规则对象进行匹配，返回匹配结果(match对象或null)
  if (typeof options === "string" || Array.isArray(options)) {
    options = { path: options }; // options参数为path数组则将其转化为对象以方便进行匹配
  }

  const { path, exact = false, strict = false, sensitive = false } = options; // 由options对象得到path、exact、strict、sensitive等参数

  const paths = [].concat(path); // 得到path数组——path prop可以设path字符串数组，此时exact,strict,sensitive等选项都为false。

  return paths.reduce((matched, path) => {
    if (!path && path !== "") return null; // path非法则直接跳过进行下一次匹配
    if (matched) return matched; // 已经匹配成功则返回匹配结果

    const { regexp, keys } = compilePath(path, {
      end: exact, // end参数等价于exact(精确匹配)
      strict,
      sensitive
    });
    const match = regexp.exec(pathname); // 根据当前URL路径得到匹配数组

    if (!match) return null; // 不匹配则返回

    const [url, ...values] = match;
    const isExact = pathname === url; // 匹配字串和URL路径一样则表示精确匹配。这一步和下面一步起始是多余的

    if (exact && !isExact) return null; // 要求精确匹配却不满足则返回null

    return {
      path, // the path used to match
      url: path === "/" && url === "" ? "/" : url, // the matched portion of the URL
      isExact, // whether or not we matched exactly
      params: keys.reduce((memo, key, index) => { // 基于keys和values(匹配分组字串数组)构建路径参数对象
        memo[key.name] = values[index];
        return memo;
      }, {})
    };
  }, null); // match初始值为null——不匹配则返回null
}

export default matchPath;
