#!/usr/bin/env bash
# 默认 USB 测试机：iPhone 12「home」。不自动选用其它已配对设备（如 Boboct21）。
#
# 用法: resolve_ios_test_device /path/to/apps/askbible-mobile
# 成功时导出 IOS_DEVICE、IOS_DEVICE_UDID。

resolve_ios_test_device() {
  local mobile_dir="${1:?mobile app dir required}"
  local manifest="$mobile_dir/ios/.local-signing/manifest.json"
  local device_name="${IOS_DEVICE:-home}"
  local udid="${IOS_DEVICE_UDID:-}"

  if [[ -z "$udid" && -f "$manifest" ]]; then
    udid="$(
      node -e "
        const fs = require('fs');
        try {
          const m = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
          process.stdout.write(String(m.devDeviceUdid || '').trim());
        } catch {
          process.exit(0);
        }
      " "$manifest"
    )"
  fi

  if [[ -z "$udid" ]]; then
    udid="00008101-001641020C98001E"
  fi

  if ! xcrun devicectl list devices 2>/dev/null | grep -qE "^${device_name} .*available \\(paired\\)"; then
    echo "✗ iPhone「${device_name}」未在线或未配对。请连接 USB 并信任此 Mac。" >&2
    return 1
  fi

  export IOS_DEVICE="$device_name"
  export IOS_DEVICE_UDID="$udid"
}
