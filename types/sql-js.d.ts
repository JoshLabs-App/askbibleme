declare module "sql.js" {
  export type Statement = {
    bind: (values: unknown[] | Record<string, unknown>) => void;
    step: () => boolean;
    getAsObject: () => Record<string, unknown>;
    run: (values?: unknown[] | Record<string, unknown>) => void;
    free: () => void;
  };

  export type Database = {
    close: () => void;
    run: (sql: string, params?: unknown[] | Record<string, unknown>) => void;
    prepare: (sql: string) => Statement;
    export: () => Uint8Array;
    exec: (sql: string) => { columns: string[]; values: unknown[][] }[];
  };

  export type SqlJsStatic = {
    Database: new (data?: ArrayLike<number> | Buffer) => Database;
  };

  function initSqlJs(config?: { locateFile?: (file: string) => string }): Promise<SqlJsStatic>;
  export default initSqlJs;
}
