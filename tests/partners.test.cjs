/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { dirname, resolve } = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");

function loadTs(filename, mocks = {}) {
  const path = resolve(__dirname, "..", filename);
  const code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  new Function("exports", "require", code)(exports, (name) => {
    if (name in mocks) return mocks[name];
    if (name.startsWith(".")) return loadTs(resolve(dirname(path), `${name}.ts`));
    return require(name);
  });
  return exports;
}

const { PARTNERS, getPartnerConfig, hasDeveloperTools } = loadTs("lib/partners/config.ts");
const { getThemeStyles, getPartnerThemeCss } = loadTs("lib/partners/themes.ts");

test("WalletConnect uses RainbowKit's native QR flow unless the custom picker is enabled", (t) => {
  const previousProjectId = process.env.NEXT_PUBLIC_PROJECT_ID;
  process.env.NEXT_PUBLIC_PROJECT_ID = "test-project";
  t.after(() => {
    if (previousProjectId === undefined) delete process.env.NEXT_PUBLIC_PROJECT_ID;
    else process.env.NEXT_PUBLIC_PROJECT_ID = previousProjectId;
  });
  let connectorParameters;
  let customConnectModal = true;
  const walletNames = ["coinbaseWallet", "metaMaskWallet", "phantomWallet", "rabbyWallet", "rainbowWallet", "safeWallet", "walletConnectWallet"];
  const walletFactories = Object.fromEntries(walletNames.map(name => [name, () => ({ id: name })]));
  const { useWagmiConfig } = loadTs("lib/wagmi-config.ts", {
    react: { useMemo: callback => callback() },
    "@rainbow-me/rainbowkit": {
      getDefaultConfig: options => options,
      getWalletConnectConnector: parameters => {
        connectorParameters = parameters;
        return details => details;
      },
    },
    "@rainbow-me/rainbowkit/wallets": walletFactories,
    "./consts": { SUPPORTED_CHAINS: [{ id: 56 }] },
    "./partners/client": { getActiveClientPartnerConfig: () => getPartnerConfig("orbs") },
    "./partners/features": { hasOrbsConnectModal: () => customConnectModal },
  });
  const config = useWagmiConfig({ partnerBrand: getPartnerConfig("orbs").brand });
  const parameters = config.walletConnectParameters;
  const modalFactory = config.wallets[0].wallets.at(-1);
  const modal = modalFactory({ projectId: config.projectId, walletConnectParameters: parameters });
  const firstPrefix = connectorParameters.walletConnectParameters.customStoragePrefix;

  assert.notEqual(firstPrefix, parameters.customStoragePrefix);
  assert.equal(parameters.customStoragePrefix, "efficient-frontier-swap", "preserve the existing wallet-link session namespace");
  assert.equal(connectorParameters.projectId, config.projectId);
  assert.equal(connectorParameters.walletConnectParameters.isNewChainsStale, false);
  assert.deepEqual(connectorParameters.walletConnectParameters.qrModalOptions, parameters.qrModalOptions);
  assert.equal(modal.createConnector({ rkDetails: { id: "walletConnectModal" } }).rkDetails.showQrModal, true);

  modalFactory({ projectId: config.projectId, walletConnectParameters: parameters });
  assert.equal(connectorParameters.walletConnectParameters.customStoragePrefix, firstPrefix, "the QR namespace must stay stable across renders and reloads");

  customConnectModal = false;
  const nativeConfig = useWagmiConfig({ partnerBrand: getPartnerConfig("orbs").brand });
  assert.ok(nativeConfig.wallets[0].wallets.includes(walletFactories.rabbyWallet));
  assert.equal(nativeConfig.wallets[0].wallets.at(-1), walletFactories.walletConnectWallet,
    "the standard picker must use RainbowKit's embedded QR code instead of opening a second modal");
  assert.equal(nativeConfig.walletConnectParameters.customStoragePrefix, parameters.customStoragePrefix);
});

test("Orbs resolves independently from the default playground", () => {
  assert.equal(getPartnerConfig(" ORBS ").id, "orbs");
  assert.equal(getPartnerConfig("default").id, "playground");
  assert.equal(getPartnerConfig("orbs").brand.name, "Orbs");
});

test("only the default frontend can enable developer mode through the URL or toggle", () => {
  for (const [key, partner] of Object.entries(PARTNERS)) {
    let updated;
    const params = new URLSearchParams("devMode=true&tab=twap");
    const { useDeveloperMode } = loadTs("lib/hooks/use-developer-mode.ts", {
      react: { useCallback: (callback) => callback },
      "next/navigation": { usePathname: () => "/", useSearchParams: () => params },
      "@/lib/partners/client": { getActiveClientPartnerConfig: () => partner },
      "@/lib/partners/config": { hasDeveloperTools },
      "@/lib/url-state": {
        updateUrlSearchParams: (_path, current, update) => {
          updated = new URLSearchParams(current);
          update(updated);
        },
      },
    });
    const mode = useDeveloperMode();
    assert.equal(mode.isDeveloperMode, key === "default", key);
    assert.equal(mode.isDeveloperToolsAvailable, key === "default", key);
    mode.setIsDeveloperMode(true);
    assert.equal(updated.get("devMode"), key === "default" ? "true" : null, key);
    assert.equal(updated.get("tab"), "twap");
  }
});

test("Orbs explicit dark theme reaches CSS and wallet tokens without changing its light theme", () => {
  const styles = getPartnerConfig("orbs").styles;
  const light = getThemeStyles(styles, "light");
  const dark = getThemeStyles(styles, "dark");
  assert.equal(light.colors.background, "#f6f6f6");
  assert.equal(dark.colors.background, "#121214");
  assert.equal(dark.colors.primary, "#c4a1ff");
  assert.equal(dark.colors.primaryForeground, "#121214");
  assert.equal(dark.formContainerBackground, "#1e1e20");
  assert.equal(dark.formPanelRadius, "0px");
  assert.equal(dark.fontFamily, light.fontFamily);
  assert.equal(styles.colors.background, "#f6f6f6");
  const css = getPartnerThemeCss(styles);
  assert.match(css, /html\.light\{color-scheme:light;--radius:0rem/);
  assert.match(css, /html\.dark\{color-scheme:dark;--radius:0rem/);
  assert.match(css, /--form-container-background:#1e1e20/);
});

const { hasOrbsConnectModal } = loadTs("lib/partners/features.ts");
test("the custom wallet picker is enabled only by the Orbs feature flag", () => {
  const orbs = getPartnerConfig("orbs");
  assert.equal(hasOrbsConnectModal(orbs, "true"), false);
  assert.equal(hasOrbsConnectModal({ ...orbs, features: { customConnectModal: true } }, "true"), true);
  assert.equal(hasOrbsConnectModal(orbs, "false"), false);
  assert.equal(hasOrbsConnectModal({ ...orbs, features: { customConnectModal: false } }, "true"), false);
  assert.equal(hasOrbsConnectModal({ ...orbs, features: undefined }, "true"), false);
  for (const partner of Object.values(PARTNERS)) {
    if (partner.id === "orbs") continue;
    assert.equal(hasOrbsConnectModal({ ...partner, features: { customConnectModal: true } }, "true"), false, partner.id);
  }
});
