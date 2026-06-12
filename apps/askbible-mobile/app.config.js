/** @type {import('expo/config').ExpoConfig} */
const appJson = require("./app.json");

const iosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME?.trim();

const plugins = [...(appJson.expo.plugins || []), "expo-apple-authentication"];
if (iosUrlScheme) {
  plugins.push(["@react-native-google-signin/google-signin", { iosUrlScheme }]);
}

module.exports = {
  expo: {
    ...appJson.expo,
    ios: {
      ...appJson.expo.ios,
      usesAppleSignIn: true,
    },
    plugins,
  },
};
