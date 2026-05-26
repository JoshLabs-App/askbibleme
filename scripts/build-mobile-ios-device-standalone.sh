#!/usr/bin/env bash
# USB 连接的 iPhone：安装 Release 独立包（内嵌 JS + 离线资源，无需 Metro / 本机 API）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export EXPO_NO_DOTENV=1
export EXPO_PUBLIC_MOBILE_BUNDLED_ONLY="${EXPO_PUBLIC_MOBILE_BUNDLED_ONLY:-1}"
export EXPO_PUBLIC_TELEMETRY_DISABLED="${EXPO_PUBLIC_TELEMETRY_DISABLED:-1}"
export MOBILE_BUNDLE_OFFLINE_MEDIA="${MOBILE_BUNDLE_OFFLINE_MEDIA:-1}"
unset EXPO_PUBLIC_ASKBIBLE_BASE_URL

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  AskBible.me · iPhone 真机（独立 Release 包）"
echo "  项目: $ROOT/apps/askbible-mobile"
echo ""
echo "  ① 同步经文 / 文案 / 自然与音乐离线资源"
echo "  ② Xcode Release 编译并安装到已连接 iPhone"
echo "  ③ 装完后可断开 Mac、断网使用（不依赖 Metro / 3450）"
echo ""
echo "  需：数据线连接、Xcode、开发者证书；首次编译较慢。"
echo "  热更新开发（需 Metro）: npm run mobile:ios:device:metro"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "→ Sync mobile bundled content (scripture, locales, icons, offline media, …)"
npm run mobile:sync-content
npm run mobile:sync-icons
npm run mobile:sync-offline-media

MOBILE="$ROOT/apps/askbible-mobile"
ENV_LOCAL="$MOBILE/.env.local"
ENV_LOCAL_BAK="$MOBILE/.env.local.release-build.bak"
if [[ -f "$ENV_LOCAL" ]]; then
  echo "→ Stashing .env.local (keep LAN dev URL out of release build)"
  mv "$ENV_LOCAL" "$ENV_LOCAL_BAK"
  trap '[[ -f "$MOBILE/.env.local.release-build.bak" ]] && mv -f "$MOBILE/.env.local.release-build.bak" "$MOBILE/.env.local"' EXIT
fi

cd "$MOBILE"

echo ""
echo "→ expo run:ios --device --configuration Release"
echo "   bundled-only=$EXPO_PUBLIC_MOBILE_BUNDLED_ONLY"
echo ""

DEVICE_ARGS=()
PHYSICAL_UDIDS=()
while IFS= read -r line; do
  # 排除 Mac 宿主机，仅收集真实 iOS 设备（兼容旧 40 位与新带横线 UDID）。
  [[ "$line" == *"Mac"* ]] && continue
  [[ "$line" =~ \(([0-9A-Fa-f]{40}|[0-9A-Fa-f]{8}-[0-9A-Fa-f]{16})\)$ ]] || continue
  PHYSICAL_UDIDS+=("${BASH_REMATCH[1]}")
done < <(xcrun xctrace list devices 2>/dev/null | awk '/^== Devices ==$/{f=1;next} /^==/{f=0} f' || true)

if [[ ${#PHYSICAL_UDIDS[@]} -eq 1 ]]; then
  echo "   目标设备 UDID: ${PHYSICAL_UDIDS[0]}"
  DEVICE_ARGS=(--device "${PHYSICAL_UDIDS[0]}")
elif [[ ${#PHYSICAL_UDIDS[@]} -gt 1 ]]; then
  echo "   检测到多台真机，将使用 expo 交互选择（或传入 UDID: npm run mobile:ios:standalone -- --device <UDID>）"
else
  echo "   未检测到 USB 真机；请连接 iPhone 后重试"
  exit 1
fi

npx expo run:ios "${DEVICE_ARGS[@]}" --configuration Release "$@"

echo ""
echo "✓ 独立版已安装到 iPhone。"
echo "  可拔掉数据线、关闭本终端；断网可读圣经与包内导读/自然/音乐（以本次同步进包的资源为准）。"
echo "  若要改内容后重装：再运行 npm run mobile:ios:device"
echo ""
