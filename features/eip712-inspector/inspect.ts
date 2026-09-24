import {
  hashTypedData,
  isAddress,
  type Hex,
  type TypedData,
  type TypedDataDomain,
} from "viem";

export type Payload = {
  domain: TypedDataDomain;
  types: TypedData;
  primaryType: string;
  message: Record<string, unknown>;
};
export type Check = {
  label: string;
  detail: string;
  status: "pass" | "fail" | "info";
};
export type Inspection = {
  payload?: Payload;
  digest?: Hex;
  checks: Check[];
  isOrder: boolean;
};
export type TokenInfo = { address: string; symbol: string; decimals: number };
export type OrderContext = {
  expected: unknown;
  tokens: TokenInfo[];
  demo: boolean;
};

export function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${path} must be an object.`);
  return value as Record<string, unknown>;
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const own = (value: object, key: string) => Object.hasOwn(value, key);
const identifier = /^[A-Za-z_][A-Za-z0-9_]*$/;
const domainTypes: Record<string, string> = {
  name: "string",
  version: "string",
  chainId: "uint256",
  verifyingContract: "address",
  salt: "bytes32",
};

/** Strict validation avoids hashing coercions, unsigned extra fields, and rounded JSON integers. */
export function parsePayload(input: unknown): Payload {
  const root = object(input, "Typed data");
  const domain = object(root.domain, "domain");
  const message = object(root.message, "message");
  const sourceTypes = object(root.types, "types");
  assert(
    typeof root.primaryType === "string" && root.primaryType !== "EIP712Domain",
    "primaryType must name a message struct in types.",
  );
  const types: Record<string, { name: string; type: string }[]> =
    Object.create(null);
  assert(
    Object.keys(sourceTypes).length <= 100,
    "Use at most 100 struct types.",
  );
  for (const [name, fields] of Object.entries(sourceTypes)) {
    assert(
      identifier.test(name) &&
        !/^(address|bool|string|bytes\d*|u?int\d*)$/.test(name),
      `Invalid struct name: ${name}.`,
    );
    assert(
      Array.isArray(fields) && fields.length <= 100,
      `types.${name} must be an array of up to 100 fields.`,
    );
    const seen = new Set<string>();
    types[name] = fields.map((entry) => {
      const field = object(entry, `types.${name}`);
      assert(
        typeof field.name === "string" &&
          identifier.test(field.name) &&
          !seen.has(field.name),
        `Invalid or duplicate field in types.${name}.`,
      );
      assert(
        typeof field.type === "string",
        `types.${name}.${field.name} needs a type.`,
      );
      seen.add(field.name);
      return { name: field.name, type: field.type };
    });
  }
  for (const fields of Object.values(types))
    for (const field of fields) {
      const base = field.type.replace(/\[(?:[1-9]\d*)?\]/g, "");
      assert(
        field.type === base ||
          /^(?:[A-Za-z_][A-Za-z0-9_]*)(?:\[(?:[1-9]\d*)?\])+$/.test(field.type),
        `Invalid type: ${field.type}.`,
      );
      const integer = /^(u?int)(\d+)$/.exec(base);
      const bytes = /^bytes(\d+)$/.exec(base);
      assert(
        own(types, base) ||
          ["address", "bool", "string", "bytes"].includes(base) ||
          (integer &&
            +integer[2] >= 8 &&
            +integer[2] <= 256 &&
            +integer[2] % 8 === 0) ||
          (bytes && +bytes[1] >= 1 && +bytes[1] <= 32),
        `Unsupported type: ${field.type}.`,
      );
    }
  assert(own(types, root.primaryType), `types is missing ${root.primaryType}.`);
  for (const key of Object.keys(domain))
    assert(own(domainTypes, key), `Unknown domain field: ${key}.`);
  // JSON chain IDs may be decimal strings. Normalize before viem infers domain fields.
  const normalizedDomain = { ...domain };
  if (own(domain, "chainId")) {
    assert(
      (typeof domain.chainId === "string" &&
        /^(0x[\da-f]+|\d+)$/i.test(domain.chainId)) ||
        (typeof domain.chainId === "number" &&
          Number.isSafeInteger(domain.chainId)),
      "domain.chainId must be an exact integer.",
    );
    normalizedDomain.chainId = BigInt(domain.chainId as string | number);
  }
  if (types.EIP712Domain) {
    for (const field of types.EIP712Domain)
      assert(
        domainTypes[field.name] === field.type,
        `Invalid domain type for ${field.name}.`,
      );
  } else {
    types.EIP712Domain = Object.keys(domainTypes)
      .filter((key) => own(domain, key))
      .map((name) => ({ name, type: domainTypes[name] }));
  }
  let count = 0;
  function validate(
    type: string,
    value: unknown,
    path: string,
    depth = 0,
  ): void {
    assert(
      depth <= 24 && ++count <= 5000,
      "Typed data is too deeply nested or too large.",
    );
    const array = /^(.*)\[(\d*)\]$/.exec(type);
    if (array) {
      assert(
        Array.isArray(value) && value.length <= 1000,
        `${path} must be an array of up to 1,000 values.`,
      );
      assert(
        !array[2] || value.length === +array[2],
        `${path} must contain ${array[2]} values.`,
      );
      value.forEach((item, i) =>
        validate(array[1], item, `${path}[${i}]`, depth + 1),
      );
    } else if (own(types, type)) {
      const obj = object(value, path);
      const fields = types[type];
      for (const key of Object.keys(obj))
        assert(
          fields.some((field) => field.name === key),
          `${path}.${key} is not declared in types and would not be signed.`,
        );
      for (const field of fields) {
        assert(own(obj, field.name), `${path}.${field.name} is missing.`);
        validate(
          field.type,
          obj[field.name],
          `${path}.${field.name}`,
          depth + 1,
        );
      }
    } else if (/^u?int\d+$/.test(type)) {
      assert(
        typeof value === "bigint" ||
          (typeof value === "number" && Number.isSafeInteger(value)) ||
          (typeof value === "string" && /^(?:-?\d+|0x[\da-f]+)$/i.test(value)),
        `${path} must be an exact integer. Quote large JSON integers as strings.`,
      );
      const n = BigInt(value as string | number | bigint);
      const bits = BigInt(type.replace(/\D/g, ""));
      const signed = type.startsWith("int");
      const limit = BigInt(1) << (signed ? bits - BigInt(1) : bits);
      assert(
        n >= (signed ? -limit : BigInt(0)) && n < limit,
        `${path} is outside the ${type} range.`,
      );
    } else if (type === "address") {
      assert(
        typeof value === "string" && isAddress(value),
        `${path} must be a valid Ethereum address.`,
      );
    } else if (type === "bool") {
      assert(typeof value === "boolean", `${path} must be true or false.`);
    } else if (type === "string") {
      assert(typeof value === "string", `${path} must be a string.`);
    } else {
      assert(
        typeof value === "string" && /^0x(?:[\da-f]{2})*$/i.test(value),
        `${path} must be even-length hex bytes.`,
      );
      assert(
        type === "bytes" || value.length === 2 + +type.slice(5) * 2,
        `${path} must contain ${type.slice(5)} bytes.`,
      );
    }
  }
  validate("EIP712Domain", normalizedDomain, "domain");
  validate(root.primaryType, message, "message");
  return {
    domain: normalizedDomain as TypedDataDomain,
    types: types as unknown as TypedData,
    primaryType: root.primaryType,
    message,
  };
}

function equivalent(a: unknown, b: unknown): boolean {
  if (
    (typeof a === "number" || typeof a === "bigint" || typeof a === "string") &&
    (typeof b === "number" || typeof b === "bigint" || typeof b === "string")
  )
    return /^0x[\da-f]*$/i.test(String(a)) && /^0x[\da-f]*$/i.test(String(b))
      ? String(a).toLowerCase() === String(b).toLowerCase()
      : String(a) === String(b);
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((v, i) => equivalent(v, b[i]))
    );
  if (a && b && typeof a === "object" && typeof b === "object") {
    const left = record(a),
      right = record(b);
    return (
      Object.keys(left).length === Object.keys(right).length &&
      Object.keys(left).every(
        (key) => own(right, key) && equivalent(left[key], right[key]),
      )
    );
  }
  return a === b;
}

export function inspect(
  input: string,
  context?: OrderContext,
  now = Date.now(),
): Inspection {
  const checks: Check[] = [];
  const check = (label: string, pass: boolean, detail: string) =>
    checks.push({ label, detail, status: pass ? "pass" : "fail" });
  try {
    assert(
      input.length <= 100_000,
      "Typed data exceeds the 100 KB input limit.",
    );
    const source = JSON.parse(input);
    const payload = parsePayload(source);
    const metadata = Object.keys(source).filter(
      (key) => !["domain", "types", "primaryType", "message"].includes(key),
    );
    if (metadata.length)
      checks.push({
        label: "Unsigned metadata",
        status: "info",
        detail: `Top-level fields ${metadata.join(", ")} are not included in the signature.`,
      });
    const digest = hashTypedData(payload);
    check(
      "Typed-data structure",
      true,
      "Declared domain and message fields have valid types and are included in the signing digest.",
    );
    const m = payload.message,
      w = record(m.witness),
      p = record(m.permitted),
      i = record(w.input);
    const isOrder =
      payload.primaryType === "RePermitWitnessTransferFrom" &&
      payload.domain.name === "RePermit" &&
      own(m, "witness") &&
      own(w, "input") &&
      own(w, "output");
    if (!payload.domain.chainId || !payload.domain.verifyingContract)
      checks.push({
        label: "Domain scope",
        status: "info",
        detail:
          "The domain does not include both a chain ID and a verifying contract. Confirm its intended scope.",
      });
    if (isOrder) {
      check(
        "Slippage range",
        BigInt(String(w.slippage)) >= BigInt(0) &&
          BigInt(String(w.slippage)) <= BigInt(10_000),
        "Slippage must not exceed 10,000 basis points (100%).",
      );
      check(
        "Permit and order agree",
        equivalent(m.spender, w.reactor) &&
          equivalent(m.nonce, w.nonce) &&
          equivalent(m.deadline, w.deadline) &&
          equivalent(p.token, i.token) &&
          equivalent(p.amount, i.maxAmount) &&
          equivalent(payload.domain.chainId, w.chainid),
        "Compares spender, nonce, expiry, token, total amount, and chain across the permit and witness.",
      );
      check(
        "Order timing",
        BigInt(String(w.deadline)) > BigInt(Math.floor(now / 1000)) &&
          BigInt(String(w.deadline)) > BigInt(String(w.start)),
        "Expiry must be in the future and later than the start time. Checked when the preview is generated.",
      );
      check(
        "Input amounts",
        BigInt(String(p.amount)) > BigInt(0) &&
          BigInt(String(i.amount)) > BigInt(0) &&
          BigInt(String(i.amount)) <= BigInt(String(p.amount)),
        "Total and per-fill amounts must be positive; a fill cannot exceed the total.",
      );
    }
    if (context) {
      const expected = parsePayload(context.expected);
      check(
        "Expected domain and types",
        payload.domain.name === expected.domain.name &&
          payload.domain.version === expected.domain.version &&
          equivalent(payload.domain, expected.domain) &&
          equivalent(payload.types, expected.types) &&
          payload.primaryType === expected.primaryType,
        "Compared with the SDK configuration captured from the order flow.",
      );
      // Nonces and absolute timestamps refresh before signing; compare the duration instead.
      const stable = (message: Record<string, unknown>) => {
        const {
          nonce: _nonce,
          deadline: _deadline,
          witness,
          ...rest
        } = message;
        const {
          nonce: _wnonce,
          start: _start,
          deadline: _end,
          ...rules
        } = record(witness);
        void _nonce;
        void _deadline;
        void _wnonce;
        void _start;
        void _end;
        return {
          ...rest,
          witness: rules,
        };
      };
      const duration = (value: Record<string, unknown>) => {
        const witness = record(value.witness);
        return BigInt(String(witness.deadline)) - BigInt(String(witness.start));
      };
      const durationDelta = duration(m) - duration(expected.message);
      check(
        "Payload matches order",
        equivalent(stable(m), stable(expected.message)) &&
          durationDelta >= BigInt(-1) &&
          durationDelta <= BigInt(1),
        "Compared with the form and SDK settings captured at export, including amounts, contracts, recipient, fees, and duration. Fresh nonces and absolute times are excluded; duration allows one second of timestamp rounding.",
      );
    } else
      checks.push({
        label: "Order comparison",
        status: "info",
        detail:
          "No order context. Open this page from the order flow to compare against the form and SDK configuration.",
      });
    if (!isOrder)
      checks.push({
        label: "Message interpretation",
        status: "info",
        detail:
          "Generic typed data: field types can be checked, but protocol-specific execution rules are not validated.",
      });
    return { payload, digest, checks, isOrder };
  } catch (error) {
    checks.push({
      label: "Cannot inspect payload",
      status: "fail",
      detail:
        error instanceof Error ? error.message : "Enter valid EIP-712 JSON.",
    });
    return { checks, isOrder: false };
  }
}
