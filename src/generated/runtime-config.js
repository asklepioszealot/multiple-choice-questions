export const APP_CONFIG = Object.freeze(
  typeof __APP_CONFIG__ !== "undefined" && __APP_CONFIG__ && typeof __APP_CONFIG__ === "object"
    ? __APP_CONFIG__
    : {},
);

export default APP_CONFIG;
