/**
 * 移动端已停用客户端采集。所有函数保留签名但不执行任何操作。
 */

export function setTelemetryLocale(_locale: string | null): void {}

export function trackTelemetry(
  _eventName: string,
  _properties?: Record<string, unknown>,
): void {}

export function flushTelemetry(): void {}
