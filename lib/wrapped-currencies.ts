import { monad } from "viem/chains";
import { Currency } from "./types";

export const wCurrencies: Record<number, Currency> = {
    1: {
      symbol: "WETH",
      address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      decimals: 18,
      logoUrl: "https://tokens-data.1inch.io/images/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2.png",
      name: "Wrapped Ether",
    },
    56: {
      symbol: "WBNB",
      address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
      decimals: 18,
      logoUrl: "https://s2.coinmarketcap.com/static/img/coins/128x128/1839.png",
      name: "Wrapped BNB",
    },
    137: {
      symbol: "WPOL",
      address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
      decimals: 18,
      logoUrl: "https://tokens-data.1inch.io/images/0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270.png",
      name: "Wrapped Polygon",
    },
    42161: {
      symbol: "WETH",
      address: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
      decimals: 18,
      logoUrl: "https://tokens-data.1inch.io/images/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2.png",
      name: "Wrapped Ether",
    },
    8453: {
      symbol: "WETH",
      address: "0x4200000000000000000000000000000000000006",
      decimals: 18,
      logoUrl: "https://tokens-data.1inch.io/images/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2.png",
      name: "Wrapped Ether",
    },
    59144: {
      symbol: "WETH",
      address: "0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f",
      decimals: 18,
      logoUrl: "https://tokens-data.1inch.io/images/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2.png",
      name: "Wrapped Ether",
    },
    146: {
      symbol: "WS",
      address: "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38",
      decimals: 18,
      logoUrl: "https://icons.llamao.fi/icons/chains/rsz_sonic",
      name: "Wrapped Sonic",
    },
    [monad.id]: {
      symbol: "WMON",
      address: "0x3bd359c1119da7da1d913d1c4d2b7c461115433a",
      decimals: 18,
      logoUrl: "https://s2.coinmarketcap.com/static/img/coins/128x128/30495.png",
      name: "Wrapped Monad",
    },
  };
  
