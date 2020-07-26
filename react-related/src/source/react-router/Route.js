import React from "react";
import { isValidElementType } from "react-is";
import PropTypes from "prop-types";
import invariant from "tiny-invariant";
import warning from "tiny-warning";

import RouterContext from "./RouterContext.js";
import matchPath from "./matchPath.js";

function isEmptyChildren(children) { // 判断React元素内容是否为空
  return React.Children.count(children) === 0;
}

function evalChildrenDev(children, props, path) { // 开发模式的children prop 函数组件的执行器。path来自<Route>上的props
  const value = children(props);

  warning( // 如果children prop 函数返回值非法则发出警告
    value !== undefined,
    "You returned `undefined` from the `children` function of " +
      `<Route${path ? ` path="${path}"` : ""}>, but you ` +
      "should have returned a React element or `null`"
  );

  return value || null;
}

/**
 * The public API for matching a single path and rendering.
 */
class Route extends React.Component {
  render() {
    return (
      <RouterContext.Consumer>
        {context => {
          invariant(context, "You should not use <Route> outside a <Router>"); // context为空说明<Route>不在<Router>中，此时抛出异常

          const location = this.props.location || context.location; // 优先使用来自props的location,没有则使用context.location
          const match = this.props.computedMatch // 如果存在computedMatch prop(<Route>作为<Switch>子元素时由<Switch>提供)则用它作为match
            ? this.props.computedMatch // <Switch> already computed the match for us
            : this.props.path // 存在path prop则使用matchPath函数基于当前URL路径(location.pathname)和props计算匹配结果
            ? matchPath(location.pathname, this.props)
            : context.match; // 没有则使用context.match(默认值)

          const props = { ...context, location, match }; // 使用context中属性作为提供给子组件的props，且更新location和match

          let { children, component, render } = this.props;

          // Preact uses an empty array as children by
          // default, so use null if that's the case.
          if (Array.isArray(children) && children.length === 0) {
            children = null;
          }

          return (
            <RouterContext.Provider value={props}>
              {props.match // 根据match判断是否匹配(match不为null则匹配)
                ? children // 若匹配则判断是否存在children prop
                  ? typeof children === "function" // 若匹配且存在children prop则判断children prop是否为函数组件
                    ? __DEV__ // 若匹配且存在children prop且children prop为函数组件则判断是否在开发模式下
                      ? evalChildrenDev(children, props, this.props.path)  // 若匹配且存在children prop且children prop为函数组件且处于开发模式下则返回执行器下children函数组件的执行结果
                      : children(props) // 若匹配且存在children prop且children prop为函数组件且处于生产模式下则直接返回children函数组件的执行结果
                    : children // 若匹配且存在children prop且children prop不是函数组件也直接返回
                  : component // 若匹配且不存在children prop则判断component prop是否存在
                  ? React.createElement(component, props)  // 若匹配且不存在children prop且component prop存在则返回以component作为type创建的React元素
                  : render // 若匹配且不存在children prop且不存在component prop则判断render prop是否存在
                  ? render(props) // 若匹配且不存在children prop且不存在component prop且render prop存在则返回其执行结果(所以render必须是函数组件)
                  : null // 若匹配且不存在children prop且不存在component prop且render prop不存在则什么都不渲染
                : typeof children === "function" // 若不匹配则判断children prop是否为函数组件
                ? __DEV__ // 若不匹配且children prop为函数组件则判断当前是否在开发模式下
                  ? evalChildrenDev(children, props, this.props.path) // 若不匹配且children prop为函数组件且当前处于开发模式下则返回执行器下children函数组件的执行结果
                  : children(props) // 若不匹配且children prop为函数组件且当前处于生产模式下则直接返回children函数组件的执行结果
                : null /* 若不匹配且没有children prop则啥都不渲染*/}
            </RouterContext.Provider>
          );
        }}
      </RouterContext.Consumer>
    );
  }
}

if (__DEV__) { // 开发模式下才进行下面的处理
  Route.propTypes = {
    children: PropTypes.oneOfType([PropTypes.func, PropTypes.node]),
    component: (props, propName) => {
      if (props[propName] && !isValidElementType(props[propName])) {
        return new Error( // 开发模式下如果component不是组件类型(函数组件/类组件)则抛出错误
          `Invalid prop 'component' supplied to 'Route': the prop is not a valid React component`
        );
      }
    },
    exact: PropTypes.bool,
    location: PropTypes.object,
    path: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.arrayOf(PropTypes.string)
    ]),
    render: PropTypes.func,
    sensitive: PropTypes.bool,
    strict: PropTypes.bool
  };

  Route.prototype.componentDidMount = function() {
    warning( // 使用Route组件时同时传入children prop和component prop则发起警告
      !(
        this.props.children &&
        !isEmptyChildren(this.props.children) &&
        this.props.component
      ),
      "You should not use <Route component> and <Route children> in the same route; <Route component> will be ignored"
    );

    warning(
      !(
        this.props.children &&
        !isEmptyChildren(this.props.children) &&
        this.props.render
      ),
      "You should not use <Route render> and <Route children> in the same route; <Route render> will be ignored"
    );

    warning(
      !(this.props.component && this.props.render),
      "You should not use <Route component> and <Route render> in the same route; <Route render> will be ignored"
    );
  };

  Route.prototype.componentDidUpdate = function(prevProps) {
    warning( // Route从非受控组件转变为受控组件——初始化时没有提供location prop，但后续又提供了。这种情况会发出警告
      !(this.props.location && !prevProps.location),
      '<Route> elements should not change from uncontrolled to controlled (or vice versa). You initially used no "location" prop and then provided one on a subsequent render.'
    );

    warning( // Route从受控组件转变为非受控组件——初始化时没有提供location prop，但后续又提供了。这种情况会发出警告
      !(!this.props.location && prevProps.location),
      '<Route> elements should not change from controlled to uncontrolled (or vice versa). You provided a "location" prop initially but omitted it on a subsequent render.'
    );
  };
}

export default Route;
