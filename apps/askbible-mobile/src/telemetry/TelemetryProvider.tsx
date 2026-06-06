/**
 * 移动端已停用客户端采集（方案一：纯服务端日志聚合）。
 * 保留组件壳以避免调用方改动。
 */
export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  return children;
}
