// TODO: Replace with React.createContext once we can assume React 16+
import createContext from "mini-create-react-context";

const createNamedContext = name => { // 根据传入的name参数创建命名Context
  const context = createContext();
  context.displayName = name;

  return context;
};

export default createNamedContext;
