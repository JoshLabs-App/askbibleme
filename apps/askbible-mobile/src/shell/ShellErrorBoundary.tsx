import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppLogoSplash } from "./AppLogoSplash";

type Props = {
  children: ReactNode;
};

type State = {
  failed: boolean;
  message: string;
};

/** Release 真机 JS 异常时避免整 App 闪退，留给用户一次重试。 */
export class ShellErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { failed: true, message: error?.message?.trim() || "Unknown error" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ message: error?.message?.trim() || "Unknown error" });
    console.warn("[ShellErrorBoundary]", error, info.componentStack);
  }

  private retry = () => {
    this.setState({ failed: false, message: "" });
  };

  render() {
    if (this.state.failed) {
      return (
        <View style={styles.root}>
          <AppLogoSplash />
          {this.state.message ? (
            <Text style={styles.errorText} numberOfLines={4}>
              {this.state.message}
            </Text>
          ) : null}
          <Pressable style={styles.retry} onPress={this.retry} accessibilityRole="button">
            <Text style={styles.retryText}>重试</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  errorText: {
    position: "absolute",
    bottom: 108,
    alignSelf: "center",
    maxWidth: "88%",
    paddingHorizontal: 16,
    fontSize: 12,
    lineHeight: 17,
    color: "rgba(255,255,255,0.82)",
    textAlign: "center",
  },
  retry: {
    position: "absolute",
    bottom: 48,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  retryText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});
