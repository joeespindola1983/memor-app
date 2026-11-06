import test from "node:test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("Expo discovers the local Swift module and its pod before Xcode build", () => {
  const script = fileURLToPath(new URL("../scripts/verify-native-autolinking.mjs", import.meta.url));
  execFileSync(process.execPath, [script], { stdio: "pipe" });
});
