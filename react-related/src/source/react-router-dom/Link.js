import React from "react";
import { __RouterContext as RouterContext } from "react-router";
import PropTypes from "prop-types";
import invariant from "tiny-invariant";
import {
  resolveToLocation,
  normalizeToLocation
} from "./utils/locationUtils.js";

// React 15 compat
const forwardRefShim = C => C; // forwardRef pollyfill——15之前不支持forwardRef
let { forwardRef } = React;
if (typeof forwardRef === "undefined") {
  forwardRef = forwardRefShim;
}

function isModifiedEvent(event) { // 判断是否时修改事件
  return !!(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey);
}

const LinkAnchor = forwardRef(
  (
    {
      innerRef, // TODO: deprecate // 15以下的备用ref
      navigate, // 导航使用的回调
      onClick, // 点击事件监听器
      ...rest
    },
    forwardedRef
  ) => {
    const { target } = rest; // 链接打开位置

    let props = {
      ...rest,
      onClick: event => {
        try {
          if (onClick) onClick(event); // 执行传入的监听器
        } catch (ex) {
          event.preventDefault(); // 捕获异常后仍然阻止默认行为
          throw ex;
        }

        if (
          !event.defaultPrevented && // onClick prevented default // onClick中没有调用过preventDefault方法
          event.button === 0 && // ignore everything but left clicks
          (!target || target === "_self") && // let browser handle "target=_blank" etc.
          !isModifiedEvent(event) // ignore clicks with modifier keys
        ) {
          event.preventDefault();
          navigate(); // 发起导航
        }
      }
    };

    // React 15 compat
    if (forwardRefShim !== forwardRef) {
      props.ref = forwardedRef || innerRef; // 15以上使用forwardedRef
    } else {
      props.ref = innerRef;
    }

    /* eslint-disable-next-line jsx-a11y/anchor-has-content */
    return <a {...props} />; // 默认使用锚点元素
  }
);

if (__DEV__) {
  LinkAnchor.displayName = "LinkAnchor";
}

/**
 * The public API for rendering a history-aware <a>.
 */
const Link = forwardRef(
  (
    {
      component = LinkAnchor, // 默认使用LinkAnchor组件，也可以自定义链接组件
      replace, // 是替换还是新增当前历史记录
      to, // 目标位置location
      innerRef, // TODO: deprecate
      ...rest
    },
    forwardedRef
  ) => {
    return (
      <RouterContext.Consumer>
        {context => {
          invariant(context, "You should not use <Link> outside a <Router>");

          const { history } = context;

          const location = normalizeToLocation( // 解析出目标URL的location
            resolveToLocation(to, context.location),
            context.location
          );

          const href = location ? history.createHref(location) : ""; // location有效则创建对应的URL字符串
          const props = {
            ...rest,
            href,
            navigate() {
              const location = resolveToLocation(to, context.location);
              const method = replace ? history.replace : history.push; // 根据replace prop决定导航使用的方法

              method(location); // 发起导航
            }
          };

          // React 15 compat
          if (forwardRefShim !== forwardRef) {
            props.ref = forwardedRef || innerRef; // 15以上使用forwardedRef
          } else {
            props.innerRef = innerRef;
          }

          return React.createElement(component, props); // 渲染视图
        }}
      </RouterContext.Consumer>
    );
  }
);

if (__DEV__) {
  const toType = PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.object,
    PropTypes.func
  ]);
  const refType = PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any })
  ]);

  Link.displayName = "Link";

  Link.propTypes = {
    innerRef: refType,
    onClick: PropTypes.func,
    replace: PropTypes.bool,
    target: PropTypes.string,
    to: toType.isRequired
  };
}

export default Link;
