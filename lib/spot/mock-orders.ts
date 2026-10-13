import { OrderStatus, OrderType, type Order } from "@orbs-network/spot-ui";
import { parseUnits, zeroAddress } from "viem";
import type { HistoryOrder, OrderToken } from "./order-tokens";
const MOCK_ORDER_ACCOUNT = "0x000000000000000000000000000000000000dEaD";

export function isMockOrder(order?: Pick<Order, "historyKey">) {
  return order?.historyKey.startsWith("mock:") ?? false;
}

const bscUsdt = { chainId: 56, address: "0x55d398326f99059ff775485246999027b3197955", symbol: "USDT", decimals: 18 } as const;
const wbnb = { chainId: 56, address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", symbol: "WBNB", decimals: 18 } as const;
const usdc = { chainId: 1, address: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", symbol: "USDC", decimals: 6 } as const;
const weth = { chainId: 1, address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", symbol: "WETH", decimals: 18 } as const;
const baseUsdc = { chainId: 8453, address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6 } as const;
const baseWeth = { chainId: 8453, address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18 } as const;
type SampleToken = OrderToken & { symbol: string; decimals: number };
type Sample = {
  type: OrderType; status: OrderStatus; input: SampleToken; output: SampleToken;
  amount: string; received: string; trades: number; filled: number;
};
const samples: Sample[] = [
  { type: OrderType.STOP_LOSS_MARKET, status: OrderStatus.Open, input: wbnb, output: bscUsdt, amount: "2", received: "1200", trades: 1, filled: 0 },
  { type: OrderType.TWAP_MARKET, status: OrderStatus.Open, input: bscUsdt, output: wbnb, amount: "1000", received: "1.5", trades: 10, filled: 4 },
  { type: OrderType.LIMIT, status: OrderStatus.Open, input: weth, output: usdc, amount: "2", received: "6800", trades: 1, filled: 0 },
  { type: OrderType.TAKE_PROFIT_LIMIT, status: OrderStatus.Open, input: baseWeth, output: baseUsdc, amount: "0.5", received: "2000", trades: 1, filled: 0 },
  { type: OrderType.TWAP_MARKET, status: OrderStatus.Completed, input: bscUsdt, output: wbnb, amount: "800", received: "1.2", trades: 8, filled: 8 },
  { type: OrderType.LIMIT, status: OrderStatus.Cancelled, input: usdc, output: weth, amount: "500", received: "0.16", trades: 1, filled: 0 },
  { type: OrderType.TWAP_LIMIT, status: OrderStatus.Cancelled, input: bscUsdt, output: wbnb, amount: "1200", received: "2", trades: 6, filled: 2 },
  { type: OrderType.STOP_LOSS_LIMIT, status: OrderStatus.Expired, input: baseWeth, output: baseUsdc, amount: "1", received: "3200", trades: 1, filled: 0 },
];

/** Generated only on an explicit mockorders=true query, with dates relative to now. */
export function createMockOrders(now = Date.now()): HistoryOrder[] {
  return samples.map((sample, index) => {
    const { input, output, type, status, trades, filled } = sample;
    const hash = `0x${(index + 1).toString(16).padStart(64, "0")}` as const;
    const totalInput = parseUnits(sample.amount, input.decimals);
    const inputPerTrade = totalInput / BigInt(trades);
    const totalOutput = parseUnits(sample.received, output.decimals);
    const outputPerTrade = totalOutput / BigInt(trades);
    const createdAt = now - (index + 1) * 3_600_000;
    const deadline = status === OrderStatus.Expired ? now - 3_600_000 : now + 86_400_000;
    const isMarketPrice = [OrderType.TWAP_MARKET, OrderType.STOP_LOSS_MARKET, OrderType.TAKE_PROFIT_MARKET].includes(type);
    const isTriggerPrice = [OrderType.STOP_LOSS_MARKET, OrderType.STOP_LOSS_LIMIT, OrderType.TAKE_PROFIT_LIMIT].includes(type);
    const fills = Array.from({ length: filled }, (_, fillIndex) => ({
      inAmount: inputPerTrade.toString(), outAmount: outputPerTrade.toString(),
      timestamp: createdAt + (fillIndex + 1) * 60_000,
      txHash: "",
    }));
    const rawOrder: Order["rawOrder"] = {
      hash, signature: "0x", timestamp: new Date(createdAt).toISOString(),
      metadata: { expectedChunks: trades, lastPriceCheck: "", nextEligibleTime: "", status: status.toLowerCase(), description: "Designer sample", displayOnlyInputTokenPriceUSD: "0", repermitDigest: hash },
      order: {
        permitted: { token: input.address, amount: totalInput.toString() }, spender: zeroAddress,
        nonce: String(index), deadline: String(Math.floor(deadline / 1000)),
        witness: {
          reactor: zeroAddress, executor: zeroAddress,
          exchange: { adapter: zeroAddress, ref: zeroAddress, share: 0, data: "0x" },
          swapper: MOCK_ORDER_ACCOUNT, nonce: String(index), deadline: String(Math.floor(deadline / 1000)),
          chainid: input.chainId, exclusivity: 0, epoch: 60, slippage: 50, freshness: 60,
          input: { token: input.address, amount: inputPerTrade.toString(), maxAmount: totalInput.toString() },
          output: { token: output.address, limit: isMarketPrice ? "1" : outputPerTrade.toString(), recipient: MOCK_ORDER_ACCOUNT },
        },
      },
    };
    return {
      version: 2, historyKey: `mock:${input.chainId}:${hash}`, id: hash, hash, repermitDigest: hash,
      type, status, maker: MOCK_ORDER_ACCOUNT, chainId: input.chainId,
      inputToken: input, outputToken: output, srcTokenAddress: input.address, dstTokenAddress: output.address,
      srcAmount: totalInput.toString(), srcAmountPerTrade: inputPerTrade.toString(),
      srcAmountFilled: (inputPerTrade * BigInt(filled)).toString(), dstAmountFilled: (outputPerTrade * BigInt(filled)).toString(),
      dstMinAmountPerTrade: isMarketPrice ? "0" : outputPerTrade.toString(),
      dstMinAmountTotal: isMarketPrice ? "0" : totalOutput.toString(),
      triggerPricePerTrade: isTriggerPrice ? outputPerTrade.toString() : "0",
      orderDollarValueIn: "0", totalTradesAmount: trades, progress: filled / trades * 100,
      fills, fillDelay: 60_000, createdAt, deadline, filledOrderTimestamp: fills.at(-1)?.timestamp ?? 0,
      isMarketPrice, isTriggerPrice, rawOrder,
    };
  });
}
