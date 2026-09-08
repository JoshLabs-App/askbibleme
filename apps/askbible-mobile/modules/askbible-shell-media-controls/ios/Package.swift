// swift-tools-version:5.9
import PackageDescription

// 只为跑测试而存在的包。
//
// model/ 里的文件同时被 podspec 的源文件通配收进 App（见 AskbibleShellMediaControls.podspec），
// 所以是同一份代码，不是副本——iOS 与 Android 的状态机因此能跑同一组用例。
// 测试目录被 podspec 显式排除，不会进 App。
//
//   cd modules/askbible-shell-media-controls/ios && swift test
let package = Package(
  name: "PlaybackModel",
  platforms: [.macOS(.v12), .iOS(.v15)],
  targets: [
    .target(name: "PlaybackModel", path: "model"),
    .testTarget(name: "PlaybackModelTests", dependencies: ["PlaybackModel"], path: "PlaybackModelTests"),
  ]
)
