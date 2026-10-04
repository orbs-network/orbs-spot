import type { Currency } from "./types";

// Wrapped native token first, followed by the default quote token.
// https://github.com/orbs-network/spot/blob/master/skill/assets/token-addressbook.md
// https://docs.robinhood.com/chain/contracts/
// https://tokens.coingecko.com/{network}/all.json
export const ADDITIONAL_CHAIN_TOKENS: Record<number, readonly [Currency, Currency]> = {
  30: [
    {
      symbol: "WRBTC",
      name: "Wrapped RBTC",
      address: "0x542fda317318ebf1d3deaf76e0b632741a7e677d",
      decimals: 18,
      logoUrl: "",
    },
    {
      symbol: "USDT0",
      name: "USDT0",
      address: "0x779ded0c9e1022225f8e0630b35a9b54be713736",
      decimals: 6,
      logoUrl: "",
    },
  ],
  4663: [
    {
      symbol: "WETH",
      name: "Wrapped Ether",
      address: "0x0bd7d308f8e1639fab988df18a8011f41eacad73",
      decimals: 18,
      logoUrl: "",
    },
    {
      symbol: "USDG",
      name: "Global Dollar",
      address: "0x5fc5360d0400a0fd4f2af552add042d716f1d168",
      decimals: 6,
      logoUrl: "",
    },
  ],
  9745: [
    {
      symbol: "WXPL",
      name: "Wrapped Plasma",
      address: "0x6100e367285b01f48d07953803a2d8dca5d19873",
      decimals: 18,
      logoUrl: "",
    },
    {
      symbol: "USDT0",
      name: "USDT0",
      address: "0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb",
      decimals: 6,
      logoUrl: "",
    },
  ],
  57073: [
    {
      symbol: "WETH",
      name: "Wrapped Ether",
      address: "0x4200000000000000000000000000000000000006",
      decimals: 18,
      logoUrl: "",
    },
    {
      symbol: "USDT0",
      name: "USDT0",
      address: "0x0200c29006150606b650577bbe7b6248f58470c1",
      decimals: 6,
      logoUrl: "",
    },
  ],
  81457: [
    {
      symbol: "WETH",
      name: "Wrapped Ether",
      address: "0x4300000000000000000000000000000000000004",
      decimals: 18,
      logoUrl: "",
    },
    {
      symbol: "USDB",
      name: "USDB",
      address: "0x4300000000000000000000000000000000000003",
      decimals: 18,
      logoUrl: "",
    },
  ],
};
