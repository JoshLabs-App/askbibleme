#!/usr/bin/env bash
# 本地测试机直装：Release 配置（内置 JS，不依赖 Metro），用开发者证书自动签名装到
# 已连接/已配对的真机上。不改项目里正式的发布签名配置（ios/.local-signing/ 那套
# App Store 描述文件留给上架用），仅在命令行临时覆盖签名参数。
#
# 用法：
#   scripts/ios-local-install.sh                 # 自动挑第一台已配对且可用的设备
#   scripts/ios-local-install.sh "home"           # 按设备名
#   scripts/ios-local-install.sh <device-udid>    # 按 UDID
#
# 首次在新设备上装：手机需先在 Xcode 里完成一次配对信任（连接后系统会弹「信任此电脑」），
# 且系统设置 > 隐私与安全性 > 开发者模式 需已开启。
set -euo pipefail

cd "$(dirname "$0")/.."
IOS_DIR="$(pwd)/ios"
DEVELOPMENT_TEAM="AJ2998VZH6"

# devicectl 的 -destination/--device 都要真 UDID，不认设备名；这里统一把
# 「设备名 or UDID or 空」解析成 UDID。设备名列宽是变长的（名字可能带空格，如
# "David iPhone"），不能按固定列号切，改成整行找 UUID 格式串。
UDID_RE='[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}|[0-9A-Fa-f]{8}(-[0-9A-Fa-f]{4}){3}-[0-9A-Fa-f]{16}'

resolve_device_udid() {
  local query="${1:-}"
  local list
  list="$(xcrun devicectl list devices 2>/dev/null | tail -n +3)"
  local line
  if [ -z "$query" ]; then
    line="$(echo "$list" | grep -m1 'available (paired)')"
  else
    line="$(echo "$list" | grep -m1 -F "$query")"
  fi
  [ -z "$line" ] && return
  echo "$line" | grep -Eo "$UDID_RE" | head -n1
}

DEVICE="$(resolve_device_udid "${1:-}")"
if [ -z "$DEVICE" ]; then
  echo "没找到匹配「${1:-<空>}」且已配对可用的 iOS 设备。用 'xcrun devicectl list devices' 自己看一下，" >&2
  echo "或者把设备名/UDID 当第一个参数传进来。" >&2
  exit 1
fi

echo "==> 目标设备: $DEVICE"

cd "$IOS_DIR"

echo "==> 用自动签名（开发证书）构建 Release..."
xcodebuild \
  -workspace AskBibleme.xcworkspace \
  -scheme AskBibleme \
  -configuration Release \
  -destination "id=$DEVICE" \
  -allowProvisioningUpdates \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM="$DEVELOPMENT_TEAM" \
  PROVISIONING_PROFILE_SPECIFIER="" \
  PROVISIONING_PROFILE="" \
  CODE_SIGN_IDENTITY="Apple Development" \
  build

APP_PATH="$(find ~/Library/Developer/Xcode/DerivedData/AskBibleme-*/Build/Products/Release-iphoneos -maxdepth 1 -name "AskBibleme.app" | head -n1)"
if [ -z "$APP_PATH" ]; then
  echo "构建产物没找到，检查上面的构建日志。" >&2
  exit 1
fi

echo "==> 安装到设备..."
xcrun devicectl device install app --device "$DEVICE" "$APP_PATH"

echo "==> 启动 App..."
xcrun devicectl device process launch --device "$DEVICE" me.askbible

echo "==> 完成。"
