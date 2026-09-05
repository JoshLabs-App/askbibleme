import path from "node:path";
import { defineConfig } from "vitest/config";

// 仓库根目录与 apps/askbible-mobile 共用同一套 vitest；`@/` 指向仓库根（与两边 tsconfig 的 paths 一致）。
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      // 残留的 git worktree 副本没有 node_modules，不能当作本仓库的测试来跑
      "**/.claude/worktrees/**",
      "**/ios/**",
      "**/android/**",
    ],
  },
});
