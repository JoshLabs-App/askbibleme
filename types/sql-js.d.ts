declare module "sql.js" {
  type SqlJsStatic = {
    Database: new (data?: ArrayLike<number> | Buffer) => {
      close: () => void;
      prepare: (sql: string) => {
        bind: (values: unknown[] | Record<string, unknown>) => void;
        step: () => boolean;
        getAsObject: () => Record<string, unknown>;
        free: () => void;
      };
    };
  };
  function initSqlJs(config?: { locateFile?: (file: string) => string }): Promise<SqlJsStatic>;
  export default initSqlJs;
}
