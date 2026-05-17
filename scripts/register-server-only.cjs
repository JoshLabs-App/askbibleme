/** tsx 批量脚本在 Next 外运行；将 server-only 注册为空模块 */
const Module = require("node:module");
const orig = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  return orig.apply(this, arguments);
};
