import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const configPath = fileURLToPath(new URL("../modules/memor-world-map/expo-module.config.json", import.meta.url));
const config = JSON.parse(readFileSync(configPath, "utf8"));
if (!config.platforms.includes("apple") || !config.apple?.modules?.includes("MemorWorldMapModule")) {
  throw new Error("MemorWorldMapModule não está registrado em apple.modules.");
}

const bin = path.join(root, "node_modules", ".bin", "expo-modules-autolinking");
const output = execFileSync(bin, ["resolve", "--platform", "apple", "--json"], {
  cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
});
const result = JSON.parse(output);
const candidate = result.modules?.find((mod) => mod.packageName === "memor-world-map");
if (!candidate) throw new Error("Expo autolinking não descobriu memor-world-map.");
if (!candidate.modules?.includes("MemorWorldMapModule")) {
  throw new Error("Expo não registrou a classe Swift MemorWorldMapModule.");
}
if (!candidate.pods?.some((p) => p.podName === "MemorWorldMap")) {
  throw new Error("Expo não encontrou o Pod MemorWorldMap; verifique a podspec.");
}
console.log("[Memor] autolinking iOS OK:", {
  packageName: candidate.packageName,
  modules: candidate.modules,
  pods: candidate.pods.map((p) => p.podName),
});
