import React from "react";
import invariant from "tiny-invariant";

import Context from "./RouterContext.js";
import HistoryContext from "./HistoryContext.js";
import matchPath from "./matchPath.js";

const useContext = React.useContext;

export function useHistory() { // 返回router下history的hook
  if (__DEV__) {
    invariant(
      typeof useContext === "function",
      "You must use React >= 16.8 in order to use useHistory()"
    );
  }

  return useContext(HistoryContext);
}

export function useLocation() { // 返回router下location的hook
  if (__DEV__) {
    invariant(
      typeof useContext === "function",
      "You must use React >= 16.8 in order to use useLocation()"
    );
  }

  return useContext(Context).location;
}

export function useParams() { // 返回router下match.params的hook
  if (__DEV__) {
    invariant(
      typeof useContext === "function",
      "You must use React >= 16.8 in order to use useParams()"
    );
  }

  const match = useContext(Context).match;
  return match ? match.params : {};
}

export function useRouteMatch(path) { // 返回当前位置是否匹配给定path字符串/对象的match(匹配结果)的hook
  if (__DEV__) {
    invariant(
      typeof useContext === "function",
      "You must use React >= 16.8 in order to use useRouteMatch()"
    );
  }

  const location = useLocation();
  const match = useContext(Context).match;

  return path ? matchPath(location.pathname, path) : match;
}
