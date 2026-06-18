import { Address, erc20Abi, getAddress, isAddress, zeroAddress } from "viem";
import { getPublicClient } from "./get-public-client";
import { getTokenKey, isNativeAddress, uniqueTokenAddresses } from "./utils";
import { Balances } from "./types";

export const MAX_BALANCE_TOKENS = 80;

const MULTICALL_BATCH_SIZE = 100;

const chunk = <T>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size)
  );

export const getBalances = async (
  chainId: number,
  address: string,
  tokens: string[]
): Promise<Balances> => {
  if (!isAddress(address)) {
    throw new Error("Invalid wallet address");
  }

  const normalizedTokens = uniqueTokenAddresses(tokens);

  if (normalizedTokens.length > MAX_BALANCE_TOKENS) {
    throw new Error(`Too many tokens requested. Max is ${MAX_BALANCE_TOKENS}`);
  }

  const account = getAddress(address);
  const includesNative = normalizedTokens.some(isNativeAddress);
  const erc20Tokens = normalizedTokens
    .filter((token) => !isNativeAddress(token) && isAddress(token))
    .map((token) => getAddress(token));

  try {
    const publicClient = getPublicClient(chainId);

    const result: Balances = {};

    await Promise.all(
      chunk(erc20Tokens, MULTICALL_BATCH_SIZE).map(async (batch) => {
        const balances = await publicClient.multicall({
          allowFailure: true,
          contracts: batch.map((token) => ({
            address: token as Address,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [account],
          })),
        });

        batch.forEach((token, index) => {
          const balance = balances[index];
          result[getTokenKey(token)] =
            balance?.status === "success" ? balance.result.toString() : "0";
        });
      })
    );

    if (includesNative) {
      const nativeBalance = await publicClient.getBalance({
        address: account,
      });
      result[zeroAddress] = nativeBalance.toString();
    }

    return result;
  } catch (error) {
    console.error("Error fetching balances:", error);
    throw error;
  }
};
