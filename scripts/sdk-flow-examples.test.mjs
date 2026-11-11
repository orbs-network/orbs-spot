import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { calculateOrder, OrderStatus, OrderType } from "@orbs-network/spot-ui";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "@/features/developer-tools/order-form-field-explanations") {
    return nextResolve(new URL("../features/developer-tools/order-form-field-explanations.ts", import.meta.url).href, context);
  }
  return nextResolve(specifier, context);
} });
const { formatAdvancedOrdersSdkFlow, formatSpotSwapSdkFlow } = await import("../features/developer-tools/snippets/sdk-flow-examples.ts");

const root = fileURLToPath(new URL("../", import.meta.url));
const swapCode = formatSpotSwapSdkFlow({ chainId: 137, partner: "external" });
const advancedPrograms = Object.values(OrderType).map(orderType => {
  const params = {
    orderType, inputTokenDecimals: 18, outputTokenDecimals: 6,
    quotedOutputAmountRaw: "4000000000", inputAmountUsd: "4000",
    inputTokenUsdPrice: "2000", outputTokenUsdPrice: "1",
    minTradeSizeUsd: 10, priceProtectionPercent: 3,
    userInput: { inputAmountUi: "2", isMarketOrder: orderType !== OrderType.LIMIT },
  };
  assert.equal(calculateOrder(params).canSubmit, true, `${orderType} test inputs must be valid`);
  return [`advanced-${orderType.toLowerCase()}.ts`, formatAdvancedOrdersSdkFlow({ formParams: params })];
});

test("generated swap and advanced-order programs compile against the installed public SDK", () => {
  // Virtual files resolve real public SDK/wallet declarations without adding build artifacts.
  const programs = new Map([...advancedPrograms, ["swap.ts", swapCode]]
    .map(([name, code]) => [path.join(root, "scripts", ".generated-sdk-examples", name), code]));
  const options = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ["lib.esnext.d.ts", "lib.dom.d.ts"],
    strict: true, skipLibCheck: true, noEmit: true, esModuleInterop: true, types: [],
  };
  const host = ts.createCompilerHost(options);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) =>
    programs.has(fileName)
      ? ts.createSourceFile(fileName, programs.get(fileName), languageVersion, true)
      : originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
  const program = ts.createProgram([...programs.keys()], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  const message = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: fileName => fileName,
    getCurrentDirectory: () => root,
    getNewLine: () => "\n",
  });
  assert.equal(diagnostics.length, 0, message);
});

test("generated SDK imports exclude APIs removed in 2.2", () => {
  const removed = new Set(["Module", "isNativeAddress", "toAmountUI", "toAmountRaw", "waitForOrder", "watchOrder", "OrderSettlementError", "executeOrder", "submitSwap"]);
  for (const [name, code] of [...advancedPrograms, ["swap.ts", swapCode]]) {
    const source = ts.createSourceFile(name, code, ts.ScriptTarget.Latest, true);
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) || statement.moduleSpecifier.text !== "@orbs-network/spot-ui") continue;
      const bindings = statement.importClause?.namedBindings;
      assert.ok(bindings && ts.isNamedImports(bindings));
      for (const element of bindings.elements) {
        const imported = (element.propertyName ?? element.name).text;
        assert.equal(removed.has(imported), false, `${name} imports removed SDK API ${imported}`);
      }
    }
  }
});

function createGeneratedPoller(date = Date) {
  const source = ts.createSourceFile("swap.ts", swapCode, ts.ScriptTarget.Latest, true);
  const declaration = source.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === "waitForSwap");
  assert.ok(declaration, "The standalone swap example must include its host poller");
  const { outputText } = ts.transpileModule(declaration.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2022 } });
  return new Function("OrderStatus", "Date", `${outputText}\nreturn waitForSwap;`)(OrderStatus, date);
}

function acceptedOrder(status = OrderStatus.Open) {
  return { id: `0x${"a".repeat(64)}`, chainId: 137, deadline: Date.now() + 60_000, status };
}

test("generated poller preserves known completion and reported cancellation/expiry", async () => {
  const poll = createGeneratedPoller();
  const client = { getOrder: () => assert.fail("Known terminal status must not request another lookup") };
  const completed = acceptedOrder(OrderStatus.Completed);
  assert.equal(await poll(client, completed), completed);
  for (const status of [OrderStatus.Cancelled, OrderStatus.Expired]) {
    await assert.rejects(poll(client, acceptedOrder(status)), /inspect history for partial fills/);
  }
});

test("generated poller stops an in-flight read when tracking is aborted", async () => {
  const poll = createGeneratedPoller();
  const controller = new AbortController();
  const reason = new Error("Stopped local tracking");
  let calls = 0;
  const client = { getOrder: async ({ signal }) => {
    calls += 1;
    controller.abort(reason);
    signal.throwIfAborted();
  } };
  await assert.rejects(poll(client, acceptedOrder(), controller.signal), error => error === reason);
  assert.equal(calls, 1);
});

test("a terminal snapshot at the tracking deadline keeps its cancellation or expiry outcome", async () => {
  for (const status of [OrderStatus.Cancelled, OrderStatus.Expired]) {
    let now = 1_000;
    const poll = createGeneratedPoller({ now: () => now });
    const accepted = { ...acceptedOrder(), deadline: 2_000 };
    const terminal = { ...accepted, status };
    const client = { getOrder: async () => { now = accepted.deadline + 60_000; return terminal; } };
    await assert.rejects(poll(client, accepted), /inspect history for partial fills/);
  }
});
