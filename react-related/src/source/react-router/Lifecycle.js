import React from "react";

class Lifecycle extends React.Component {
  componentDidMount() { // 挂载完成时执行传入onMount回调，执行传入当前实例作为参数
    if (this.props.onMount) this.props.onMount.call(this, this);
  }

  componentDidUpdate(prevProps) { // 更细完成时执行传入onUpdate回调，执行传入当前实例和旧的props作为参数
    if (this.props.onUpdate) this.props.onUpdate.call(this, this, prevProps);
  }

  componentWillUnmount() { // 卸载时执行传入onUnmount回调，执行传入当前实例作为参数
    if (this.props.onUnmount) this.props.onUnmount.call(this, this);
  }

  render() {
    return null; // 因为不会作为渲染内容所以啥都不渲染
  }
}

export default Lifecycle;
