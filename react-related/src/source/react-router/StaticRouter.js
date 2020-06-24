import React from "react";
import PropTypes from "prop-types";
import { createLocation, createPath } from "history";
import invariant from "tiny-invariant";
import warning from "tiny-warning";

import Router from "./Router.js";

function addLeadingSlash(path) { // 添加首斜杠
  return path.charAt(0) === "/" ? path : "/" + path;
}

function addBasename(basename, location) { // 为location的pathname(路径)添加指定基路径
  if (!basename) return location; // 没有传入basename则直接返回location

  return {
    ...location,
    pathname: addLeadingSlash(basename) + location.pathname
  };
}

function stripBasename(basename, location) { // 为location的pathname去掉指定的基路径
  if (!basename) return location; // 没有传入basename则直接返回location

  const base = addLeadingSlash(basename);

  if (location.pathname.indexOf(base) !== 0) return location; // pathname不包含basename也直接返回location

  return {
    ...location,
    pathname: location.pathname.substr(base.length)
  };
}

function createURL(location) { // 将location转化为fullpath(pathname+search+hash)
  return typeof location === "string" ? location : createPath(location);
}

function staticHandler(methodName) { // 生成用于提示StaticRouter不支持某些操作的回调
  return () => {
    invariant(false, "You cannot %s with <StaticRouter>", methodName);
  };
}

function noop() {}

/**
 * The public top-level API for a "static" <Router>, so-called because it
 * can't actually change the current location. Instead, it just records
 * location changes in a context object. Useful mainly in testing and
 * server-rendering scenarios.
 */
class StaticRouter extends React.Component {
  navigateTo(location, action) { // 通过context模拟导航行为
    const { basename = "", context = {} } = this.props; // 从props获取基路径和导航类型
    context.action = action; // PUSH,REPLACE,POP
    context.location = addBasename(basename, createLocation(location)); // 为导航目标的路径属性添加基路径
    context.url = createURL(context.location); // 用fullpath字符串作为相对url
  }

  handlePush = location => this.navigateTo(location, "PUSH"); // 进行push导航
  handleReplace = location => this.navigateTo(location, "REPLACE"); // 进行replace导航
  handleListen = () => noop; // 不支持导航监听
  handleBlock = () => noop; // 不支持设置提示信息

  render() {
    const { basename = "", context = {}, location = "/", ...rest } = this.props;

    const history = {
      createHref: path => addLeadingSlash(basename + createURL(path)),
      action: "POP",
      location: stripBasename(basename, createLocation(location)),
      push: this.handlePush,
      replace: this.handleReplace,
      go: staticHandler("go"), // 不支持go API
      goBack: staticHandler("goBack"), // 不支持 back API
      goForward: staticHandler("goForward"),
      listen: this.handleListen,
      block: this.handleBlock
    };

    return <Router {...rest} history={history} staticContext={context} />;
  }
}

if (__DEV__) {
  StaticRouter.propTypes = {
    basename: PropTypes.string,
    context: PropTypes.object,
    location: PropTypes.oneOfType([PropTypes.string, PropTypes.object])
  };

  StaticRouter.prototype.componentDidMount = function() {
    warning( // 开发模式下发出提示——StaticRouter会忽略自定义history
      !this.props.history,
      "<StaticRouter> ignores the history prop. To use a custom history, " +
        "use `import { Router }` instead of `import { StaticRouter as Router }`."
    );
  };
}

export default StaticRouter;
