import React from "react";
import { Switch, Route } from "react-router";

function renderRoutes(routes, extraProps = {}, switchProps = {}) { // 将路由配置数组渲染为<Switch>包裹的多个<Route>
  return routes ? (
    <Switch {...switchProps}>
      {routes.map((route, i) => (
        <Route
          key={route.key || i}
          path={route.path}
          exact={route.exact}
          strict={route.strict}
          render={props => // 通过render prop渲染
            route.render ? (
              route.render({ ...props, ...extraProps, route: route }) // 路由配置以route prop传入路由组件
            ) : (
              <route.component {...props} {...extraProps} route={route} /> // 路由配置以route prop传入路由组件
            )
          }
        />
      ))}
    </Switch>
  ) : null;
}

export default renderRoutes;
