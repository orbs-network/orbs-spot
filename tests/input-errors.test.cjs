/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { test } = require("node:test");

const { InputErrors } = require("@orbs-network/spot-ui");
const translations = require("../lib/spot-translations.json");

const translationKeyOverrides = {
  [InputErrors.MISSING_LIMIT_PRICE]: "emptyLimitPrice",
};

test("every SDK input error has readable UI copy", () => {
  for (const errorType of Object.values(InputErrors)) {
    const translationKey = translationKeyOverrides[errorType] ?? errorType;
    const message = translations[translationKey];

    assert.equal(
      typeof message,
      "string",
      `Missing translation for SDK input error: ${errorType}`,
    );
    assert.ok(message.trim(), `Empty translation for SDK input error: ${errorType}`);
    assert.notEqual(message, errorType, `Raw error key shown for: ${errorType}`);
  }
});
