import { createLocation } from "history";

export const resolveToLocation = (to, currentLocation) => // 解析目标位置location
  typeof to === "function" ? to(currentLocation) : to;

export const normalizeToLocation = (to, currentLocation) => { // 将目标位置转化为location
  return typeof to === "string"
    ? createLocation(to, null, null, currentLocation)
    : to;
};
