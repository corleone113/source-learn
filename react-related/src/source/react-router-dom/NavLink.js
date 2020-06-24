import React from "react";
import { __RouterContext as RouterContext, matchPath } from "react-router";
import PropTypes from "prop-types";
import invariant from "tiny-invariant";
import Link from "./Link.js";
import {
  resolveToLocation,
  normalizeToLocation
} from "./utils/locationUtils.js";

// React 15 compat
const forwardRefShim = C => C;
let { forwardRef } = React;
if (typeof forwardRef === "undefined") {
  forwardRef = forwardRefShim;
}

function joinClassnames(...classnames) { // 转化为空格分隔的字符串
  return classnames.filter(i => i).join(" ");
}

/**
 * A <Link> wrapper that knows if it's "active" or not.
 */
const NavLink = forwardRef(
  (
    {
      "aria-current": ariaCurrent = "page",
      activeClassName = "active",
      activeStyle,
      className: classNameProp,
      exact,
      isActive: isActiveProp,
      location: locationProp,
      sensitive,
      strict,
      style: styleProp,
      to,
      innerRef, // TODO: deprecate
      ...rest
    },
    forwardedRef
  ) => {
    return (
      <RouterContext.Consumer>
        {context => {
          invariant(context, "You should not use <NavLink> outside a <Router>");

          const currentLocation = locationProp || context.location; // 获取当前位置location, 可以通过
          const toLocation = normalizeToLocation( // 解析出目标location
            resolveToLocation(to, currentLocation),
            currentLocation
          );
          const { pathname: path } = toLocation; // 使用pathname作为路径规则字符串
          // Regex taken from: https://github.com/pillarjs/path-to-regexp/blob/master/index.js#L202
          const escapedPath =
            path && path.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1"); // 特殊字符进行转义

          const match = escapedPath // 如果escapedPath则计算匹配结果，这个匹配结果用于判断激活状态
            ? matchPath(currentLocation.pathname, {
                path: escapedPath,
                exact, // end和strict只有在提供了locationProp的情况才有效果，因为在使用context.location的情况下，currentLocation.pathname和escapedPath总是匹配的
                sensitive,
                strict
              })
            : null;
          const isActive = !!(isActiveProp // 有激活状态判定回调则调用它得到激活状态
            ? isActiveProp(match, currentLocation)
            : match);

          const className = isActive
            ? joinClassnames(classNameProp, activeClassName) // 处于激活状态则附加activeClassName
            : classNameProp;
          const style = isActive ? { ...styleProp, ...activeStyle } : styleProp; // 处于激活状态则附加activeStyle

          const props = {
            "aria-current": (isActive && ariaCurrent) || null,
            className,
            style,
            to: toLocation,
            ...rest
          };

          // React 15 compat
          if (forwardRefShim !== forwardRef) {
            props.ref = forwardedRef || innerRef; // React 15以上使用forwardedRef
          } else {
            props.innerRef = innerRef;
          }

          return <Link {...props} />;
        }}
      </RouterContext.Consumer>
    );
  }
);

if (__DEV__) {
  NavLink.displayName = "NavLink";

  const ariaCurrentType = PropTypes.oneOf([
    "page",
    "step",
    "location",
    "date",
    "time",
    "true"
  ]);

  NavLink.propTypes = {
    ...Link.propTypes,
    "aria-current": ariaCurrentType,
    activeClassName: PropTypes.string,
    activeStyle: PropTypes.object,
    className: PropTypes.string,
    exact: PropTypes.bool,
    isActive: PropTypes.func,
    location: PropTypes.object,
    sensitive: PropTypes.bool,
    strict: PropTypes.bool,
    style: PropTypes.object
  };
}

export default NavLink;
