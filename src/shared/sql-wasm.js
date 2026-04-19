export function resolveSqlWasmUrl() {
  if (typeof process !== "undefined" && process.versions?.node) {
    return `${process.cwd().replace(/\\/g, "/")}/node_modules/sql.js/dist/sql-wasm.wasm`;
  }

  const resolvedUrl = new URL("../../node_modules/sql.js/dist/sql-wasm.wasm", import.meta.url);
  return resolvedUrl.href;
}

export default Object.freeze({
  resolveSqlWasmUrl,
});
