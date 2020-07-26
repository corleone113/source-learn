declare var document: Document;

declare class RouteRegExp extends RegExp { // pathToRegexp返回的正则对象的类型，带有一个keys数组属性，其中存放所有路径参数相关信息的对象
  keys: Array<{ name: string, optional: boolean }>;
}

declare type PathToRegexpOptions = { // pathToRegexp方法的选项对象的类型
  sensitive?: boolean, // true表示大小写敏感
  strict?: boolean, // true表示末尾斜杠也考虑在内.
  end?: boolean // true表示结尾也要匹配，相当于精确匹配——和react路由的exact prop一样
}

declare module 'path-to-regexp' { // path-to-regexp模块类型
  declare module.exports: {
    (path: string, keys?: Array<?{ name: string }>, options?: PathToRegexpOptions): RouteRegExp;
    compile: (path: string) => (params: Object) => string;
  }
}

declare type Dictionary<T> = { [key: string]: T }

declare type NavigationGuard = ( // 路由守卫类型
  to: Route,
  from: Route,
  next: (to?: RawLocation | false | Function | void) => void
) => any

declare type AfterNavigationHook = (to: Route, from: Route) => any

type Position = { x: number, y: number }; // 滚动坐标类型
type PositionResult = Position | { selector: string, offset?: Position } | void; // 滚动坐标(坐标结果)类型

declare type RouterOptions = { // 路由器选项类型
  routes?: Array<RouteConfig>; // 路由配置对象数组
  mode?: string; // 路由模式——决定history版本
  fallback?: boolean; // 不支持history.pushState和history.replaceState时是否回退到哈希模式
  base?: string; // 路由的基路径，默认值为 '/'
  linkActiveClass?: string; // 全局配置的路由匹配时应用于链接的类样式
  linkExactActiveClass?: string; // 全局配置的路由精确匹配时应用于链接的类样式
  parseQuery?: (query: string) => Object; // 查询字符串转对象的函数
  stringifyQuery?: (query: Object) => string; // 查询参数对象转查询字符串的函数
  scrollBehavior?: ( // 导航结束时的滚动处理函数
    to: Route, // 目标路由
    from: Route, // 导航前的路由
    savedPosition: ?Position // 滚动坐标位置，可选参数
  ) => PositionResult | Promise<PositionResult>; // 返回滚动坐标，支持异步滚动
}

declare type RedirectOption = RawLocation | ((to: Route) => RawLocation) // 字符串或下面Location类型的对象或返回这两种类型的函数

declare type RouteConfig = { // 路由配置对象的类型
  path: string; // 匹配路径字符串——类似 /some/:id/path1/:address 这样的字符串。
  name?: string; // 该路由的名称
  component?: any; // 该路由匹配时渲染的Vue组件——即路由组件。
  components?: Dictionary<any>; // name(自定义名称)到组件的映射表——存放命名视图
  redirect?: RedirectOption; // 重定向URL地址——URL匹配path时会重定向到redirect指定的URL
  alias?: string | Array<string>; // 路径别名，是和path一样格式的字符串，还可以是数组(设置多个别名)，匹配时URL路径保持不变且实际匹配的是该路由，
  children?: Array<RouteConfig>; //该路由的子路由——嵌套路由配置
  beforeEnter?: NavigationGuard; // 该路由的前置钩子
  meta?: any; // 匹配时携带的元数据，由路由记录携带。
  props?: boolean | Object | Function; // 匹配时携带的属性参数，会作为props传递给路由组件
  caseSensitive?: boolean; // 匹配路径时是否大小写敏感
  pathToRegexpOptions?: PathToRegexpOptions; // pathToRegexp的配置项(path-to-regexp这里使用的版本为1.8)
}

declare type RouteRecord = { // 路由记录的类型
  path: string; // 来自RouteConfig
  regex: RouteRegExp; // 由pathToRegexp根据path生成的正则
  components: Dictionary<any>; // 来自RouteConfig，没有提供时RouteConfig.component会被转化{default:component} 作为components
  instances: Dictionary<any>; // name到路由组件实例的映射表，和components中的组件对应
  name: ?string; // 来自RouteConfig
  parent: ?RouteRecord; // 父级路由记录
  redirect: ?RedirectOption; // 来自RouteConfig
  matchAs: ?string; // alias通过这个值进行匹配
  beforeEnter: ?NavigationGuard; // 来自RouteConfig
  meta: any; // 来自RouteConfig
  props: boolean | Object | Function | Dictionary<boolean | Object | Function>; // 实际上只有最后一种是有效的(针对3.3.4)，前面几种可能是暂时保留以备扩展
}

declare type Location = { // 代表URL地址的对象类型，此类型主要用于进行路由匹配
  _normalized?: boolean; // 是否经过normalizeLocation处理
  name?: string; // 路由的name
  path?: string; // URL路径而不是匹配规则字符串
  hash?: string; // hash片段
  query?: Dictionary<string>; // 查询参数对象
  params?: Dictionary<string>; // 路径参数对象
  append?: boolean; // true表示拼接路径，false表示替换路径
  replace?: boolean; // true表示调用router.push，false表示调用router.replace
}

declare type RawLocation = string | Location

declare type Route = {
  path: string; // URL路径而不是匹配规则字符串
  name: ?string;
  hash: string;
  query: Dictionary<string>; // 查询参数对象
  params: Dictionary<string>; // 路径参数对象
  fullPath: string; // 完整路径
  matched: Array<RouteRecord>; // 匹配的路由记录数组
  redirectedFrom?: string; // 重定向来源
  meta?: any;
}
