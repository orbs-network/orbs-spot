/** Reserve for wrapping and approval at twice the current gas price, with a
 * capped extra buffer for data fees. This is a budget, not a fee guarantee. */
export function spendableNativeBalance(balance: bigint, gasPrice: bigint) {
  if (gasPrice <= BigInt(0) || balance <= BigInt(0)) return BigInt(0);
  const executionBudget = gasPrice * BigInt(300_000) * BigInt(2);
  const balanceBuffer = balance / BigInt(200);
  const dataFeeBuffer = balanceBuffer < executionBudget ? balanceBuffer : executionBudget;
  const reserve = executionBudget + dataFeeBuffer;
  return balance > reserve ? balance - reserve : BigInt(0);
}
