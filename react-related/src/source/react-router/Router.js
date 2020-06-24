import React from "react";
import PropTypes from "prop-types";
import warning from "tiny-warning";

import HistoryContext from "./HistoryContext.js";
import RouterContext from "./RouterContext.js";

/**
 * The public API for putting history on context.
 */
class Router extends React.Component {
  static computeRootMatch(pathname) { // 返回根路径('/')的匹配对象(match)
    return { path: "/", url: "/", params: {}, isExact: pathname === "/" };
  }

  constructor(props) {
    super(props);

    this.state = {
      location: props.history.location // 初始化location对象。location来自props.history，和当前URL对应
    };

    // This is a bit of a hack. We have to start listening for location
    // changes here in the constructor in case there are any <Redirect>s
    // on the initial render. If there are, they will replace/push when
    // they mount and since cDM fires in children before parents, we may
    // get a new location before the <Router> is mounted.
    this._isMounted = false; // 是否挂载完成
    this._pendingLocation = null; // 挂载完成前若存在跳转则location保存在这个属性上

    if (!props.staticContext) { // 非StaticRouter
      this.unlisten = props.history.listen(location => { // Redirect组件会在挂载完成时调用history.replace/push进行跳转，又因为子组件实例比父组件实例先完成挂载，所以Router中Redirect会比Router先监听到location变化并执行回调，因此这里通过_pendingLocation在挂载完成保存最新的location,避免落后Redirect一步
        if (this._isMounted) { // 若已完成挂载则更新自身状态的location对象
          this.setState({ location });
        } else { // 挂载完成前监听到location变化则将其保存在_pendingLocation中
          this._pendingLocation = location;
        }
      });
    }
  }

  componentDidMount() {
    this._isMounted = true; // 挂载完成

    if (this._pendingLocation) { // 挂载完成前发生过跳转则更新本地状态的location对象
      this.setState({ location: this._pendingLocation });
    }
  }

  componentWillUnmount() {
    if (this.unlisten) this.unlisten(); // 清理监听器
  }

  render() {
    return (
      <RouterContext.Provider
        value={{
          history: this.props.history, // 提供给路由组件实例的history。来自props
          location: this.state.location, // 提供给路由组件实例的默认值location。来自state，且路由组件实例获取位置信息应该访问location而不是history.location，因为每次导航后history.location都会被替换(触发中途取消导航)
          match: Router.computeRootMatch(this.state.location.pathname), // 提供给路由组件实例的默认match对象(匹配结果)。如果路由React元素使用它则该路由视图应该是当前路由器的默认视图
          staticContext: this.props.staticContext // 对于StaticRouter(用于SSR)才需要提供
        }}
      >
        <HistoryContext.Provider // HistoryContext是用于useHistory(react-router提供的自定义hook)的context——通过useHistory可以在非路由组件实例中访问router的history
          children={this.props.children || null}
          value={this.props.history}
        />
      </RouterContext.Provider>
    );
  }
}

if (__DEV__) {
  Router.propTypes = { // 开发模式下定义propTypes
    children: PropTypes.node,
    history: PropTypes.object.isRequired,
    staticContext: PropTypes.object
  };

  Router.prototype.componentDidUpdate = function(prevProps) {
    warning( // 如果在组件树的任何位置修改history指向那么在开发模式下会发出警告
      prevProps.history === this.props.history,
      "You cannot change <Router history>"
    );
  };
}

export default Router;
