import { monad } from "viem/chains";
import type { Currency } from "./types";

export const wCurrencies: Record<number, Currency> = {
  1: {
    symbol: "WETH",
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    decimals: 18,
    logoUrl:
      "https://tokens-data.1inch.io/images/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2.png",
    name: "Wrapped Ether",
  },
  10: {
    symbol: "WETH",
    address: "0x4200000000000000000000000000000000000006",
    decimals: 18,
    logoUrl: "https://s2.coinmarketcap.com/static/img/coins/128x128/1027.png",
    name: "Wrapped Ether",
  },
  14: {
    symbol: "WFLR",
    address: "0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d",
    decimals: 18,
    logoUrl:
      "https://res.cloudinary.com/sparkdex/image/upload/q_100/v1/website-assets/coins/wflr?_a=DATAg1AAZAA0",
    name: "Wrapped Flare",
  },
  56: {
    symbol: "WBNB",
    address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    decimals: 18,
    logoUrl: "https://s2.coinmarketcap.com/static/img/coins/128x128/1839.png",
    name: "Wrapped BNB",
  },
  130: {
    symbol: "WETH",
    address: "0x4200000000000000000000000000000000000006",
    decimals: 18,
    logoUrl:
      "https://tokens-data.1inch.io/images/130/0x4200000000000000000000000000000000000006_0x042e6d078c6cf9e13a618396b0aa40181bcb43921ebdb5fabc8fb1124d516156.webp",
    name: "Wrapped Ether",
  },
  137: {
    symbol: "WPOL",
    address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    decimals: 18,
    logoUrl:
      "https://tokens-data.1inch.io/images/0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270.png",
    name: "Wrapped Polygon",
  },
  146: {
    symbol: "WS",
    address: "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38",
    decimals: 18,
    logoUrl: "https://icons.llamao.fi/icons/chains/rsz_sonic",
    name: "Wrapped Sonic",
  },
  196: {
    symbol: "WOKB",
    address: "0xe538905cf8410324e03A5A23C1c177a474D59b2b",
    decimals: 18,
    logoUrl: "https://s2.coinmarketcap.com/static/img/coins/128x128/3897.png",
    name: "Wrapped OKB",
  },
  999: {
    symbol: "WHYPE",
    address: "0x5555555555555555555555555555555555555555",
    decimals: 18,
    logoUrl: "https://s2.coinmarketcap.com/static/img/coins/128x128/32196.png",
    name: "Wrapped HYPE",
  },
  1329: {
    symbol: "WSEI",
    address: "0xE30feDd158A2e3b13e9badaeABaFc5516e95e8C7",
    decimals: 18,
    logoUrl: "https://s2.coinmarketcap.com/static/img/coins/128x128/23149.png",
    name: "Wrapped SEI",
  },
  42161: {
    symbol: "WETH",
    address: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
    decimals: 18,
    logoUrl:
      "https://tokens-data.1inch.io/images/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2.png",
    name: "Wrapped Ether",
  },
  43114: {
    symbol: "WAVAX",
    address: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
    decimals: 18,
    logoUrl:
      "https://tokens-data.1inch.io/images/0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7.png",
    name: "Wrapped AVAX",
  },
  59144: {
    symbol: "WETH",
    address: "0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f",
    decimals: 18,
    logoUrl:
      "https://tokens-data.1inch.io/images/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2.png",
    name: "Wrapped Ether",
  },
  747474: {
    symbol: "WETH",
    address: "0xee7d8bcfb72bc1880d0cf19822eb0a2e6577ab62",
    decimals: 18,
    logoUrl: "https://katana.network/assets/weth-logo.svg",
    name: "Wrapped Ether",
  },
  80094: {
    symbol: "WBERA",
    address: "0x6969696969696969696969696969696969696969",
    decimals: 18,
    logoUrl: "https://berascan.com/token/images/wrappedbera_ofc_64.png",
    name: "Wrapped Bera",
  },
  5000: {
    symbol: "WMNT",
    address: "0x78c1b0C915C4FAA5FfA6CaA1F0219DA63d7f4cb8",
    decimals: 18,
    logoUrl: "https://s2.coinmarketcap.com/static/img/coins/128x128/27614.png",
    name: "Wrapped Mantle",
  },
  [monad.id]: {
    symbol: "WMON",
    address: "0x3bd359c1119da7da1d913d1c4d2b7c461115433a",
    decimals: 18,
    logoUrl: "https://s2.coinmarketcap.com/static/img/coins/128x128/30495.png",
    name: "Wrapped Monad",
  },
  4326: {
    symbol: "WETH",
    address: "0x4200000000000000000000000000000000000006",
    decimals: 18,
    logoUrl:
      "https://tokens-data.1inch.io/images/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2.png",
    name: "Wrapped Ether",
  },
  8453: {
    symbol: "WETH",
    address: "0x4200000000000000000000000000000000000006",
    decimals: 18,
    logoUrl:
      "https://tokens-data.1inch.io/images/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2.png",
    name: "Wrapped Ether",
  },
};
