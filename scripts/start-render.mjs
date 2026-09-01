import { spawn } from "node:child_process";

const port = process.env.PORT || "3000";

const nextBin = new URL("../node_modules/next/dist/bin/next", import.meta.url);
const child = spawn(process.execPath, [nextBin.pathname, "start", "--hostname", "0.0.0.0", "--port", port], {
  env: process.env,
  stdio: "inherit",
});

function shutdown(signal) {
  child.kill(signal);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
child.on("exit", (code, signal) => {
  process.exit(code ?? (signal ? 1 : 1));
});
