/**
 * 必须在 expo-router/entry 之前执行（见 index.js）。
 * RN 0.81 Fusebox：任意 console.warn 会插入 "Open debugger to view warnings." 黄条；
 * ignoreAllLogs 对该条目不可靠，需在 LogBoxData.addLog 层丢弃 warn。
 */
const { LogBox } = require("react-native");
const LogBoxData = require("react-native/Libraries/LogBox/Data/LogBoxData");

const IGNORE_PATTERNS = [
  "Open debugger to view warnings.",
  "[expo-av]: Expo AV has been deprecated",
  "Require cycle",
  "Sending `onAnimatedValueUpdate` with no listeners registered",
  "An error occurred while requiring the 'ExpoClipboard' module",
  "[googleSignIn]",
  "[googleOAuthBrowser]",
  "[googleOAuthSession]",
  "[memberAuth]",
  "[MemberAuthProvider]",
  "[askbibleBaseUrl]",
  "[playback]",
  "[scripture-audio]",
];

let addLogPatched = false;

function suppressDevLogBox() {
  // 阻止 Fusebox 迁移黄条（showFuseboxWarningsMigrationMessageOnce）。
  try {
    Object.defineProperty(global, "__FUSEBOX_HAS_FULL_CONSOLE_SUPPORT__", {
      value: false,
      writable: false,
      configurable: true,
    });
  } catch {
    global.__FUSEBOX_HAS_FULL_CONSOLE_SUPPORT__ = false;
  }

  LogBox.ignoreAllLogs(true);
  LogBox.ignoreLogs(IGNORE_PATTERNS);
  LogBoxData.addIgnorePatterns(IGNORE_PATTERNS);
  LogBoxData.setDisabled(true);
  LogBoxData.clear();
  // addLog 里排队的 setImmediate(appendNewLog) 可能在 clear 之后再写入。
  setTimeout(() => {
    LogBoxData.setDisabled(true);
    LogBoxData.clear();
  }, 0);

  if (!addLogPatched) {
    addLogPatched = true;
    const originalAddLog = LogBoxData.addLog;
    LogBoxData.addLog = (log) => {
      if (log?.level === "warn") {
        return;
      }
      return originalAddLog(log);
    };
  }
}

if (__DEV__) {
  suppressDevLogBox();
}

module.exports = { suppressDevLogBox };
