import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { excludePrebuiltEnvFiles } from "./exclude-prebuilt-env.mjs";

test("removes env upload references and copies while preserving runtime configuration and source files", t => {
  const root = mkdtempSync(join(tmpdir(), "orbs-prebuilt-env-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const functionsDir = join(root, "output", "functions");
  const functionDir = join(functionsDir, "api", "rpc.func");
  mkdirSync(functionDir, { recursive: true });
  const sourceEnv = join(root, ".env");
  writeFileSync(sourceEnv, "RPC_URL=local-source\n");
  writeFileSync(join(functionDir, ".env"), "RPC_URL=copied-source\n");
  const configPath = join(functionDir, ".vc-config.json");
  const config = {
    runtime: "nodejs24.x",
    handler: "___next_launcher.cjs",
    environment: { RPC_URL: "https://rpc.example.com" },
    filePathMap: {
      ".env": ".env",
      ".env.example": ".env.example",
      ".env.production.local": ".env.production.local",
      ".next/server/app/api/rpc/route.js": ".next/server/app/api/rpc/route.js",
      "node_modules/package/.env.fixture": "node_modules/package/.env.fixture",
    },
  };
  writeFileSync(configPath, JSON.stringify(config));
  symlinkSync("rpc.func", join(functionsDir, "api", "balances.func"));

  assert.equal(excludePrebuiltEnvFiles(functionsDir), 3);
  assert.equal(existsSync(join(functionDir, ".env")), false);
  assert.equal(readFileSync(sourceEnv, "utf8"), "RPC_URL=local-source\n");
  for (const file of [".env", ".env.example", ".env.production.local"]) delete config.filePathMap[file];
  assert.deepEqual(JSON.parse(readFileSync(configPath, "utf8")), config);
  assert.equal(existsSync(join(functionsDir, "api", "balances.func")), true);
  assert.equal(excludePrebuiltEnvFiles(functionsDir), 0);
});
