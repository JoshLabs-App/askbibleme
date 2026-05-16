import path from "node:path";
import initSqlJs, { type SqlJsStatic } from "sql.js";

let sqlJsPromise: Promise<SqlJsStatic> | null = null;

/** 进程内单例初始化 sql.js（wasm 路径固定于 node_modules）。 */
export function getSqlJsStatic(cwd: string): Promise<SqlJsStatic> {
  if (!sqlJsPromise) {
    const wasmPath = path.join(cwd, "node_modules", "sql.js", "dist", "sql-wasm.wasm");
    sqlJsPromise = initSqlJs({ locateFile: () => wasmPath });
  }
  return sqlJsPromise;
}
