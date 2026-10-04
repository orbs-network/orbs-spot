/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve, dirname } = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");
const { hashTypedData } = require("viem");
function load(file, overrides = {}) {
  const fullPath = resolve(__dirname, file);
  const code = ts.transpileModule(readFileSync(fullPath, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};
  new Function("exports", "require", code)(
    exports,
    (dependency) =>
      overrides[dependency] ??
      (dependency.startsWith(".")
        ? load(resolve(dirname(fullPath), dependency + ".ts"))
        : require(dependency)),
  );
  return exports;
}
const { inspect } = load("../features/eip712-inspector/inspect.ts");
const other = `0x${"22".repeat(20)}`;
const payload = () => ({
  domain: {
    name: "Example",
    version: "1",
    chainId: 1,
    verifyingContract: other,
  },
  types: {
    Transfer: [
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "approved", type: "bool" },
    ],
  },
  primaryType: "Transfer",
  message: {
    recipient: "0x1111111111111111111111111111111111111111",
    amount: "1000000000000000000",
    approved: true,
  },
});
const fail = (p, pattern) =>
  assert.match(inspect(JSON.stringify(p)).checks.at(-1).detail, pattern);

test("preserves the digest for the exact payload, including a string domain chain ID", () => {
  const p = payload();
  assert.equal(inspect(JSON.stringify(p)).digest, hashTypedData(p));
  p.domain.chainId = "1";
  assert.equal(inspect(JSON.stringify(p)).digest, hashTypedData(payload()));
});
test("rejects rounded integers, missing fields, unsigned fields, invalid addresses, bool coercion and overflow", () => {
  let p = payload();
  p.message.amount = 9007199254740992;
  fail(p, /Quote large/);
  p = payload();
  delete p.message.amount;
  fail(p, /missing/);
  p = payload();
  p.message.hiddenRecipient = other;
  fail(p, /would not be signed/);
  p = payload();
  p.message.recipient = "0x123";
  fail(p, /valid Ethereum/);
  p = payload();
  p.message.approved = "false";
  fail(p, /true or false/);
  p = payload();
  p.message.amount = (2n ** 256n).toString();
  fail(p, /outside/);
});
test("rejects unsigned domain fields and malformed schemas", () => {
  let p = payload();
  p.types.EIP712Domain = [{ name: "name", type: "string" }];
  fail(p, /would not be signed/);
  p = payload();
  p.types.Transfer.push({ name: "amount", type: "uint256" });
  fail(p, /duplicate/);
  p = payload();
  p.types.Transfer[1].type = "uint";
  fail(p, /Unsupported type/);
  p = payload();
  p.types.Transfer[1].type = "Missing";
  fail(p, /Unsupported type/);
  p = payload();
  p.domain.surprise = 1;
  fail(p, /Unknown domain/);
});
test("validates arrays recursively and enforces fixed lengths and bytes size", () => {
  const p = payload();
  p.types.Transfer = [{ name: "items", type: "Item[2]" }];
  p.types.Item = [{ name: "value", type: "bytes2" }];
  p.message = { items: [{ value: "0xabcd" }, { value: "0x1234" }] };
  assert.ok(inspect(JSON.stringify(p)).digest);
  p.message.items[1].value = "0xaa";
  fail(p, /2 bytes/);
  p.message.items.pop();
  fail(p, /2 values/);
});
function order() {
  // Reuse the documented order schema; no network/wallet access is needed.
  const source = readFileSync(
    resolve(__dirname, "../features/developer-tools/snippets/code-examples.ts"),
    "utf8",
  );
  const start = source.indexOf("export const PERMIT_DATA_RESPONSE =");
  const end = source.indexOf("\nexport const CANCEL_EXAMPLE_DATA", start);
  const code = ts.transpileModule(source.slice(start, end), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};
  new Function("exports", code)(exports);
  const example = exports.PERMIT_DATA_RESPONSE,
    m = example.order,
    w = m.witness;
  m.spender = w.reactor;
  m.permitted.amount = w.input.maxAmount = "100";
  w.input.amount = "50";
  w.start = "1000";
  m.deadline = w.deadline = "2000";
  return {
    domain: example.domain,
    types: example.types,
    primaryType: example.primaryType,
    message: m,
  };
}
test("order checks separate internal consistency, expiry, and captured intent", () => {
  const p = order();
  const context = { expected: structuredClone(p), tokens: [], demo: false };
  let result = inspect(JSON.stringify(p), context, 1500000);
  assert.equal(result.checks.filter((c) => c.status === "fail").length, 0);
  p.message.witness.output.recipient = other;
  result = inspect(JSON.stringify(p), context, 1500000);
  assert.equal(
    result.checks.find((c) => c.label === "Payload matches order").status,
    "fail",
  );
  p.message.permitted.amount = "101";
  assert.equal(
    inspect(JSON.stringify(p), context, 1500000).checks.find(
      (c) => c.label === "Permit and order agree",
    ).status,
    "fail",
  );
  assert.equal(
    inspect(JSON.stringify(order()), undefined, 2500000).checks.find(
      (c) => c.label === "Order timing",
    ).status,
    "fail",
  );
});
test("fresh timestamps and nonces preserve intent but changed duration and domain do not", () => {
  const p = order();
  const context = { expected: structuredClone(p), tokens: [], demo: false };
  p.message.nonce = p.message.witness.nonce = "99";
  p.message.witness.start = "2000";
  p.message.deadline = p.message.witness.deadline = "3000";
  let result = inspect(JSON.stringify(p), context, 1500000);
  assert.equal(
    result.checks.find((c) => c.label === "Payload matches order").status,
    "pass",
  );
  p.message.deadline = p.message.witness.deadline = "4000";
  assert.equal(
    inspect(JSON.stringify(p), context, 1500000).checks.find(
      (c) => c.label === "Payload matches order",
    ).status,
    "fail",
  );
  p.domain.name = "repermit";
  assert.equal(
    inspect(JSON.stringify(p), context, 1500000).checks.find(
      (c) => c.label === "Expected domain and types",
    ).status,
    "fail",
  );
});
test("malformed JSON and oversized inputs return useful errors", () => {
  assert.equal(inspect("{").checks[0].status, "fail");
  assert.match(inspect(" ".repeat(100001)).checks[0].detail, /100 KB/);
});

const { orderValues, duration } = load(
  "../features/eip712-inspector/order-values.ts",
);
test("friendly preview converts each token with its own decimals and derives per-token prices", () => {
  const p = order();
  const w = p.message.witness;
  const tokens = [
    { address: w.input.token, symbol: "ETH", decimals: 18 },
    { address: other, symbol: "USDC", decimals: 6 },
  ];
  w.output.token = other;
  p.message.permitted.amount = w.input.maxAmount = "1000000000000000000";
  w.input.amount = "500000000000000000";
  w.output.limit = "1500000000";
  w.epoch = 1800;
  const review = orderValues(p, tokens);
  assert.equal(review.totalInput, "1 ETH");
  assert.equal(review.inputPerTrade, "0.5 ETH");
  assert.equal(review.minimumOutput, "3,000 USDC");
  assert.equal(review.minimumOutputPerTrade, "1,500 USDC");
  assert.equal(review.price(w.output.limit), "3,000 USDC per ETH");
  assert.equal(review.tradeCount, "2");
  assert.equal(review.kind, "TWAP order");
  assert.equal(duration(w.epoch), "30 minutes");
  w.input.maxAmount = "1000000000000000001";
  assert.equal(orderValues(p, tokens).tradeCount, "3");
  assert.equal(orderValues(p, tokens).smallerFinalTrade, true);
  w.input.maxAmount = "750000000000000000";
  assert.equal(orderValues(p, tokens).minimumOutput, "2,250 USDC");
  assert.equal(orderValues(p, tokens).minimumOutputPerTrade, "1,500 USDC");
  w.input.maxAmount = w.input.amount;
  assert.equal(orderValues(p, tokens).minimumOutput, "1,500 USDC");
  w.input.amount = "0";
  assert.equal(orderValues(p, tokens).minimumOutput, "—");
});
test("preview shortens decimals without losing tiny amounts or changing order data", () => {
  const p = order();
  const token = { address: p.message.witness.input.token, symbol: "ETH", decimals: 18 };
  p.message.witness.input.amount = "1000000000000000000";
  const original = JSON.stringify(p);
  const review = orderValues(p, [token]);
  assert.equal(review.amount("14122171666666666", token), "≈ 0.014122 ETH");
  assert.equal(review.amount("1", token), "0.000000000000000001 ETH");
  assert.equal(review.amount("1234567", token), "≈ 0.000000000001235 ETH");
  assert.equal(review.amount("1234567890123456789012345678", token), "≈ 1,234,567,890.123457 ETH");
  assert.equal(review.amount("0", token), "0 ETH");
  assert.equal(review.price("14122171666666666"), "≈ 0.014122 ETH per ETH");
  assert.equal(JSON.stringify(p), original);
});
test("unknown decimals keep amounts unavailable and market orders do not promise zero output", () => {
  const p = order();
  p.message.witness.output.limit = "0";
  const review = orderValues(p, []);
  assert.equal(review.totalInput, "—");
  assert.equal(review.price("100"), undefined);
  assert.equal(review.minimumOutput, "Market price");
  assert.equal(review.minimumOutputPerTrade, "Market price");
  p.message.witness.output.triggerLower = "50";
  assert.equal(orderValues(p, []).kind, "Stop-loss order");
  assert.equal(duration(3661), "1 hour, 1 minute, 1 second");
});

test("token metadata uses app RPC, reads decimals and supports legacy symbols", async () => {
  const viem = require("viem");
  const calls = [];
  let legacy = false;
  let decimalValue = 6;
  const { fetchTokenMetadata } = load(
    "../features/eip712-inspector/token-metadata.ts",
    {
      viem: {
        ...viem,
        http: (url, options) => {
          calls.push({ url, options });
          return {};
        },
        createPublicClient: () => ({
          readContract: async ({ functionName, abi }) => {
            if (functionName === "decimals") return decimalValue;
            if (!legacy) return "USDC";
            if (abi[0].outputs?.[0]?.type === "bytes32")
              return viem.stringToHex("MKR", { size: 32 });
            throw new Error("Legacy symbol");
          },
        }),
      },
    },
  );
  const abort = new AbortController();
  const token = await fetchTokenMetadata({ id: 137 }, other, abort.signal);
  assert.deepEqual(token, { address: other, decimals: 6, symbol: "USDC" });
  assert.equal(calls[0].url, "/api/rpc?chainId=137");
  assert.equal(calls[0].options.fetchOptions.signal, abort.signal);
  legacy = true;
  assert.equal((await fetchTokenMetadata({ id: 1 }, other)).symbol, "MKR");
  decimalValue = 256;
  await assert.rejects(
    fetchTokenMetadata({ id: 1 }, other),
    /decimals are invalid/,
  );
});
