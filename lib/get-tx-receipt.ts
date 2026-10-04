import { TransactionReceiptNotFoundError } from "viem";
import { getPublicClient } from "./get-public-client";

/** One bounded read. The browser polls pending confirmations, not a server worker. */
export const getTxReceipt = async (chainId: number, hash: `0x${string}`) => {
  const client = getPublicClient(chainId);
  try {
    const receipt = await client.getTransactionReceipt({ hash });
    const blockNumber = await client.getBlockNumber({ cacheTime: 0 });
    return blockNumber >= receipt.blockNumber + BigInt(1) ? receipt : undefined;
  } catch (error) {
    if (error instanceof TransactionReceiptNotFoundError) return undefined;
    throw error;
  }
};
