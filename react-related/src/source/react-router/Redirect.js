import React from "react";
import PropTypes from "prop-types";
import { createLocation, locationsAreEqual } from "history";
import invariant from "tiny-invariant";

import Lifecycle from "./Lifecycle.js";
import RouterContext from "./RouterContext.js";
import generatePath from "./generatePath.js";

/**
 * The public API for navigating programmatically with a component.
 */
function Redirect({ computedMatch, to, push = false }) {
  return (
    <RouterContext.Consumer>
      {context => {
        invariant(context, "You should not use <Redirect> outside a <Router>");

        const { history, staticContext } = context;

        const method = push ? history.push : history.replace;
        const location = createLocation( // 创建重定向目标location
          computedMatch // 判断computedMatch是否存在——computedMatch应该是一个对象，且带有pathname、search、hash等属性
            ? typeof to === "string" // computedMatch存在则再判断to是否为字符串
              ? generatePath(to, computedMatch.params) // computedMatch存在且to为字符串则基于to prop和computedMatch.params生成符合to规则且路径参数和computedMatch.params对应的目标URL路径
              : {
                  ...to, // 若computedMatch存在且to为对象则返回一个location对象
                  pathname: generatePath(to.pathname, computedMatch.params) // 生成to.pathname(传入的to的pathname可以是一个路径规则字符串比如'/some/:id?')规则且路径参数和computedMatch.params对应的目标URL路径
                }
            : to // 不存在computedMatch则直接使用to作为目标位置
        );

        // When rendering in a static context,
        // set the new location immediately.
        if (staticContext) { // 若用于StaticRouter则直接发起导航(重定向)，而不需要用LifeCycle组件管理生命周期
          method(location);
          return null;
        }

        return (
          <Lifecycle // 默认情况通过Lifecycle实现的重定向只在挂载(页面加载/刷新)和更新且to发生变化时才会触发，所以要将Redirect用在Switch中，Switch组件会利用其from来进行重定向
            onMount={() => {
              method(location);
            }}
            onUpdate={(self, prevProps) => {
              const prevLocation = createLocation(prevProps.to);
              if (
                !locationsAreEqual(prevLocation, { // 根据更新前后的location判断是否需要重定向(导航)
                  ...location,
                  key: prevLocation.key
                })
              ) {
                method(location);
              }
            }}
            to={to} // 传入to方便后续更新时进行比对
          />
        );
      }}
    </RouterContext.Consumer>
  );
}

if (__DEV__) {
  Redirect.propTypes = {
    push: PropTypes.bool,
    from: PropTypes.string,
    to: PropTypes.oneOfType([PropTypes.string, PropTypes.object]).isRequired
  };
}

export default Redirect;
