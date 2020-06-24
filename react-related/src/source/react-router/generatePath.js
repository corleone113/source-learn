import pathToRegexp from "path-to-regexp";

const cache = {}; // 根据path规则字符串缓存正则的映射表
const cacheLimit = 10000; // 缓存上限数量
let cacheCount = 0; // 缓存数量计数器

function compilePath(path) { // 返回一个回调，这个回调会将params(路径参数对象)转化为符合path规则的路径字符串
  if (cache[path]) return cache[path]; // 存在缓存则直接使用缓存

  const generator = pathToRegexp.compile(path); // 生成正则

  if (cacheCount < cacheLimit) { // 不超过上限则进行缓存
    cache[path] = generator;
    cacheCount++;
  }

  return generator;
}

/**
 * Public API for generating a URL pathname from a path and parameters.
 */
function generatePath(path = "/", params = {}) { // 返回符合path规则的路径参数和params对象对应的URL路径，若path为'/'则直接返回
  return path === "/" ? path : compilePath(path)(params, { pretty: true });
}

export default generatePath;
