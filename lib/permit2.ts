import { permit2Address } from "@orbs-network/liquidity-hub-sdk";
import {
  encodeAbiParameters,
  parseSignature,
  signatureToCompactSignature,
  type Address,
  type Hex,
} from "viem";

export const PERMIT2_ADDRESS = permit2Address as Address;
export const PERMIT2_MAX_AMOUNT =
  (BigInt(1) << BigInt(160)) - BigInt(1);
export const PERMIT2_MAX_EXPIRATION =
  (BigInt(1) << BigInt(48)) - BigInt(1);
export const PERMIT2_EXISTING_ALLOWANCE = "0x01" as const;

export const permit2Abi = [
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
      { name: "nonce", type: "uint48" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const permit2Types = {
  PermitSingle: [
    { name: "details", type: "PermitDetails" },
    { name: "spender", type: "address" },
    { name: "sigDeadline", type: "uint256" },
  ],
  PermitDetails: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint160" },
    { name: "expiration", type: "uint48" },
    { name: "nonce", type: "uint48" },
  ],
} as const;

export const getPermit2Domain = (chainId: number) =>
  ({
    name: "Permit2",
    chainId,
    verifyingContract: PERMIT2_ADDRESS,
  }) as const;

export const getPermit2Amount = (amount: string) => {
  const value = BigInt(amount);
  if (value > PERMIT2_MAX_AMOUNT) {
    throw new Error("Amount exceeds Permit2 uint160 limit");
  }
  return value;
};

export const hasPermit2Allowance = ({
  amount,
  expiration,
  requiredAmount,
}: {
  amount: bigint;
  expiration: bigint;
  requiredAmount: bigint;
}) => amount >= requiredAmount && expiration > BigInt(Math.floor(Date.now() / 1000));

export const encodeParaswapPermit2 = ({
  permitAmount,
  deadline,
  expiration,
  nonce,
  signature,
}: {
  permitAmount: bigint;
  deadline: number;
  expiration: bigint;
  nonce: bigint;
  signature: Hex;
}) => {
  const compactSignature = signatureToCompactSignature(parseSignature(signature));
  return encodeAbiParameters(
    [
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "bytes32" },
      { type: "bytes32" },
    ],
    [
      permitAmount,
      expiration,
      nonce,
      BigInt(deadline),
      compactSignature.r,
      compactSignature.yParityAndS,
    ],
  );
};
