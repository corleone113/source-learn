import { matchPath, Router } from "react-router";

function matchRoutes(routes, pathname, /*not public API*/ branch = []) { // 收集route配置数组中和指定pathname匹配的记录汇总为一个数组
  routes.some(route => { // 找到第一个匹配的路由就结束遍历
    const match = route.path
      ? matchPath(pathname, route) // 优先使用pathname和route.path的匹配结果
      : branch.length
      ? branch[branch.length - 1].match // use parent match
      : Router.computeRootMatch(pathname); // use default "root" match

    if (match) {
      branch.push({ route, match }); // 匹配成功则添加一条记录

      if (route.routes) { // 存在子路由则递归调用matchRoutes进行处理
        matchRoutes(route.routes, pathname, branch);
      }
    }

    return match;
  });

  return branch;
}

export default matchRoutes;
