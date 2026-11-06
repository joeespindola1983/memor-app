#!/usr/bin/env node
/**
 * Guard the QA build against silently falling back to provider="none".
 * Prints metadata only: NEVER prints RVApiKey / the client key.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const file = resolve(root, ".env");
if (existsSync(file)) loadEnvFile(file);
const key = process.env.REACTVISION_CLIENT_KEY?.trim() ?? "";
const expectedProject = process.env.REACTVISION_PROJECT_ID?.trim()
  || "381827b7-e4e6-422a-98f9-733c861f3f39";

function fail(message) {
  console.error("❌ Memor VPS: " + message);
  process.exitCode = 1;
}
function pass(message) { console.log("✓ " + message); }

if (!key.startsWith("rv_client_") || key.length < 32) {
  fail("REACTVISION_CLIENT_KEY ausente ou inválida no .env.");
  console.log("  Edite .env e adicione a chave pública rv_client_... (sem aspas extras).");
  process.exit(1);
}
pass("Chave pública de cliente encontrada; valor oculto.");

let data;
try {
  const raw = execFileSync("npx", ["expo", "config", "--json"], {
    cwd: root, env: process.env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"]
  });
  data = JSON.parse(raw);
} catch {
  fail("Expo não conseguiu resolver app.config.ts; execute npm install.");
  process.exit(1);
}

const options = data.plugins?.find(p => Array.isArray(p) && p[0] === "@reactvision/react-viro")?.[1];
if (!options) fail("Plugin nativo @reactvision/react-viro ausente.");
else {
  if (options.provider !== "reactvision") fail("Plugin configurado com provider diferente de reactvision.");
  else pass("Plugin nativo provider=reactvision.");
  if (options.rvProjectId !== expectedProject) fail("Project ID diferente do configurado no .env.");
  else pass("Project ID confirmado: " + expectedProject);
  if (options.rvApiKey !== key) fail("A chave não chegou ao plugin nativo.");
  else pass("A chave foi injetada no plugin (valor oculto).");
}

if (data.extra?.reactvisionConfigured !== true) fail("Manifesto Expo tem reactvisionConfigured=false.");
else pass("Manifesto Expo publica reactvisionConfigured=true.");

const ios = join(root, "ios");
if (existsSync(ios)) {
  const names = readdirSync(ios, { withFileTypes: true })
    .filter(x => x.isDirectory()).map(x => join(ios, x.name, "Info.plist"))
    .filter(existsSync);
  if (!names.length) console.log("• Info.plist não encontrado; confira novamente após expo prebuild.");
  for (const name of names) {
    const xml = readFileSync(name, "utf8");
    const get = k => xml.match(new RegExp("<key>" + k + "<\\/key>\\s*<string>([^<]*)<\\/string>"))?.[1];
    const project = get("RVProjectId");
    const nativeKey = get("RVApiKey");
    if (project && nativeKey) {
      if (project !== expectedProject || nativeKey !== key) fail("Info.plist divergente: execute npx expo prebuild --clean --platform ios.");
      else pass("Info.plist iOS contém credenciais esperadas (chave ocultada).");
    } else if (name.includes("Memor")) {
      fail("Info.plist do aplicativo sem RVApiKey/RVProjectId: refaça o prebuild.");
    }
  }
}

if (process.exitCode) console.error("VPS não está pronto para testes de revisita.");
else console.log("✅ Configuração VPS verificada. Recompile o app e inicie uma captura VPS real.");
