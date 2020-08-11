import React from "react";
import PropTypes from "prop-types";
import hoistStatics from "hoist-non-react-statics";
import invariant from "tiny-invariant";

import RouterContext from "./RouterContext.js";

/**
 * A public higher-order component to access the imperative API
 */
function withRouter(Component) { // 让目标组件可以使用history、match、location等属性
  const displayName = `withRouter(${Component.displayName || Component.name})`;
  const C = props => {
    const { wrappedComponentRef, ...remainingProps } = props; // 获取ref对象

    return (
      <RouterContext.Consumer>
        {context => {
          invariant(
            context,
            `You should not use <${displayName} /> outside a <Router>`
          );
          return (
            <Component
              {...remainingProps}
              {...context}
              ref={wrappedComponentRef} // 通过wrappedComponentRef.current获取包装后的组件实例
            />
          );
        }}
      </RouterContext.Consumer>
    );
  };

  C.displayName = displayName;
  C.WrappedComponent = Component; // 指向原组件的静态属性

  if (__DEV__) {
    C.propTypes = {
      wrappedComponentRef: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.func,
        PropTypes.object
      ])
    };
  }

  return hoistStatics(C, Component); // 从原组件上拷贝名称为非React特有关键字的静态属性,同时让该组件不响应路由变化。
}

export default withRouter;
