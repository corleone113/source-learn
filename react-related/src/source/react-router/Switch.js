import React from "react";
import PropTypes from "prop-types";
import invariant from "tiny-invariant";
import warning from "tiny-warning";

import RouterContext from "./RouterContext.js";
import matchPath from "./matchPath.js";

/**
 * The public API for rendering the first <Route> that matches.
 */
class Switch extends React.Component {
  render() {
    return (
      <RouterContext.Consumer>
        {context => {
          invariant(context, "You should not use <Switch> outside a <Router>");

          const location = this.props.location || context.location; // 每次都都会获取location，优先使用来自props的location

          let element, match;

          // We use React.Children.forEach instead of React.Children.toArray().find()
          // here because toArray adds keys to all child elements and we do not want
          // to trigger an unmount/remount for two <Route>s that render the same
          // component at different URLs.
          React.Children.forEach(this.props.children, child => {
            if (match == null && React.isValidElement(child)) { // 如果还没有匹配且当前子节点(React元素)有效时才计算element和match的值
              element = child;

              const path = child.props.path || child.props.from; // 优先使用子节点(React元素)的path prop(针对Route),其次才考虑使用from(针对Redirect)

              match = path
                ? matchPath(location.pathname, { ...child.props, path }) // 又path则进行匹配
                : context.match; // 否则使用默认的match
            }
          });

          return match
            ? React.cloneElement(element, { location, computedMatch: match }) // 匹配成功就渲染对应子节点并复用location和提供computedMatch
            : null;
        }}
      </RouterContext.Consumer>
    );
  }
}

if (__DEV__) {
  Switch.propTypes = {
    children: PropTypes.node,
    location: PropTypes.object
  };

  Switch.prototype.componentDidUpdate = function(prevProps) {
    warning( // Switch从非受控组件转变为受控组件——初始化时没有提供location prop，但后续又提供了。这种情况会发出警告
      !(this.props.location && !prevProps.location),
      '<Switch> elements should not change from uncontrolled to controlled (or vice versa). You initially used no "location" prop and then provided one on a subsequent render.'
    );

    warning( // Switch从非受控组件转变为受控组件——初始化时没有提供location prop，但后续又提供了。这种情况会发出警告
      !(!this.props.location && prevProps.location),
      '<Switch> elements should not change from controlled to uncontrolled (or vice versa). You provided a "location" prop initially but omitted it on a subsequent render.'
    );
  };
}

export default Switch;
