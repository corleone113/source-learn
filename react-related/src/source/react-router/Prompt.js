import React from "react";
import PropTypes from "prop-types";
import invariant from "tiny-invariant";

import Lifecycle from "./Lifecycle.js";
import RouterContext from "./RouterContext.js";

/**
 * The public API for prompting the user before navigating away from a screen.
 */
function Prompt({ message, when = true }) {
  return (
    <RouterContext.Consumer>
      {context => {
        invariant(context, "You should not use <Prompt> outside a <Router>");

        if (!when || context.staticContext) return null; // 不满足when条件或用在StaticRouter中时则不做跳转前确认

        const method = context.history.block; // 引用history.block

        return (
          <Lifecycle
            onMount={self => {
              self.release = method(message); // 设置提示信息并注册跳转前处理函数
            }}
            onUpdate={(self, prevProps) => {
              if (prevProps.message !== message) { // 提示信息变更了则重新注册确认处理函数
                self.release();
                self.release = method(message);
              }
            }}
            onUnmount={self => {
              self.release(); // 注销跳转确认处理函数
            }}
            message={message} // 提供message prop用于更新阶段比对
          />
        );
      }}
    </RouterContext.Consumer>
  );
}

if (__DEV__) {
  const messageType = PropTypes.oneOfType([PropTypes.func, PropTypes.string]);

  Prompt.propTypes = {
    when: PropTypes.bool,
    message: messageType.isRequired
  };
}

export default Prompt;
