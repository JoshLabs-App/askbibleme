declare module "sql.js" {
  type Statement = {
    bind: (values: unknown[] | Record<string, unknown>) => void;
    step: () => boolean;
    getAsObject: () => Record<string, unknown>;
    run: (values?: unknown[] | Record<string, unknown>) => void;
    free: () => void;
  };

  type Database = {
    close: () => void;
    run: (sql: string, params?: unknown[] | Record<string, unknown>) => void;
    prepare: (sql: string) => Statement;
    export: () => Uint8Array;
  };

  type SqlJsStatic = {
    Database: new (data?: ArrayLike<number> | Buffer) => Database;
  };

  function initSqlJs(config?: { locateFile?: (file: string) => string }): Promise<SqlJsStatic>;
  export default initSqlJs;
}
