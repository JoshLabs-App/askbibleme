/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: "widget",
  name: "AskBibleDailyVerse",
  displayName: " ",
  icon: "../assets/icon.png",
  deploymentTarget: "17.0",
  bundleIdentifier: ".widget",
  entitlements: {
    "com.apple.security.application-groups":
      config.ios?.entitlements?.["com.apple.security.application-groups"] ?? [
        "group.me.askbible.shared",
      ],
  },
});
