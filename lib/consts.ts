import {
  arbitrum,
  avalanche,
  base,
  berachain,
  bsc,
  flare,
  katana,
  linea,
  mainnet,
  mantle,
  monad,
  optimism,
  polygon,
  sei,
  sonic,
  unichain,
  xLayer,
} from "viem/chains";
import { defineChain, type Chain } from "viem";
import { FormTab } from "./types";

export const hyperEvmChain: Chain = defineChain({
  id: 999,
  name: "HyperEVM",
  network: "hyperevm",
  nativeCurrency: {
    decimals: 18,
    name: "HYPE",
    symbol: "HYPE",
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.hyperliquid.xyz/evm"],
    },
  },
  blockExplorers: {
    default: {
      name: "HyperEVMScan",
      url: "https://hyperevmscan.io",
    },
  },
  contracts: {
    multicall3: {
      address: "0xca11bde05977b3631167028862be2a173976ca11",
      blockCreated: 0,
    },
  },
});

export const megaethChain: Chain = defineChain({
  id: 4326,
  name: "MegaETH",
  network: "megaeth",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["https://mainnet.megaeth.com/rpc"],
      webSocket: ["wss://mainnet.megaeth.com/ws"],
    },
  },
  blockExplorers: {
    default: {
      name: "MegaETH Etherscan",
      url: "https://mega.etherscan.io",
    },
  },
  contracts: {
    multicall3: {
      address: "0xca11bde05977b3631167028862be2a173976ca11",
      blockCreated: 0,
    },
  },
});

export const MAIN_CHAINS = [
  mainnet,
  arbitrum,
  bsc,
  linea,
  base,
  sonic,
  polygon,
  monad,
] as const;

export const SPOT_CHAINS = [
  bsc,
  linea,
  sei,
  base,
  sonic,
  polygon,
  berachain,
  flare,
  avalanche,
  monad,
  arbitrum,
  mainnet,
  katana,
  optimism,
  mantle,
  hyperEvmChain,
  unichain,
  xLayer,
  megaethChain,
] as const;

export const SUPPORTED_CHAINS = SPOT_CHAINS;

export type SupportedChainId = (typeof SUPPORTED_CHAINS)[number]["id"];

type DefaultTokenPair = {
  input: string;
  output: string;
};

export const DEFAULT_CHAIN_ID = bsc.id;

export const DEFAULT_TOKENS = {
  [bsc.id]: {
    input: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    output: "0x55d398326f99059ff775485246999027b3197955",
  },
  [polygon.id]: {
    input: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
    output: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  },
  [base.id]: {
    input: "0x4200000000000000000000000000000000000006",
    output: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
  [mainnet.id]: {
    input: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    output: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  },
  [arbitrum.id]: {
    input: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
    output: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
  },
  [linea.id]: {
    input: "0x176211869ca2b568f2a7d4ee941e073a821ee1ff",
    output: "0xe5d7c2a44ffddf6b295a15c148167daaaf5cf34f",
  },
  [sei.id]: {
    input: "0xe30fedd158a2e3b13e9badaeabafc5516e95e8c7",
    output: "0x5cf6826140c1c56ff49c808a1a75407cd1df9423",
  },
  [sonic.id]: {
    input: "0x039e2fb66102314ce7b64ce5ce3e5183bc94ad38",
    output: "0x29219dd400f2bf60e5a23d13be72b486d4038894",
  },
  [monad.id]: {
    input: "0x3bd359c1119da7da1d913d1c4d2b7c461115433a",
    output: "0x754704bc059f8c67012fed69bc8a327a5aafb603",
  },
  [berachain.id]: {
    input: "0x6969696969696969696969696969696969696969",
    output: "0x549943e04f40284185054145c6e4e9568c1d3241",
  },
  [flare.id]: {
    input: "0x1d80c49bbbcd1c0911346656b529df9e5c2f783d",
    output: "0x0b38e83b86d491735feaa0a791f65c2b99535396",
  },
  [avalanche.id]: {
    input: "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7",
    output: "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e",
  },
  [katana.id]: {
    input: "0xee7d8bcfb72bc1880d0cf19822eb0a2e6577ab62",
    output: "0x203a662b0bd271a6ed5a60edfbd04bfce608fd36",
  },
  [optimism.id]: {
    input: "0x4200000000000000000000000000000000000006",
    output: "0x7f5c764cbc14f9669b88837ca1490cca17c31607",
  },
  [mantle.id]: {
    input: "0x78c1b0c915c4faa5fffa6cabf0219da63d7f4cb8",
    output: "0x09bc4e0d864854c6afb6eb9a9cdf58ac190d0df9",
  },
  [hyperEvmChain.id]: {
    input: "0x5555555555555555555555555555555555555555",
    output: "0xb88339cb7199b77e23db6e890353e22632ba630f",
  },
  [unichain.id]: {
    input: "0x4200000000000000000000000000000000000006",
    output: "0x078d782b760474a361dda0af3839290b0ef57ad6",
  },
  [xLayer.id]: {
    input: "0xe538905cf8410324e03a5a23c1c177a474d59b2b",
    output: "0x74b7f16337b8972027f6196a17a631ac6de26d22",
  },
  [megaethChain.id]: {
    input: "0x4200000000000000000000000000000000000006",
    output: "0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb",
  },
} satisfies Record<number, DefaultTokenPair>;

export const BASE_TOKENS = {
  [bsc.id]: [
    "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    "0x55d398326f99059fF775485246999027B3197955",
    "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3",
    "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c",
  ],
  [polygon.id]: [
    "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
    "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6",
    "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
  ],
  [base.id]: [
    "0x4200000000000000000000000000000000000006",
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
    "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
    "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
  ],
  [mainnet.id]: [
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  ],
  [arbitrum.id]: [
    "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
    "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
    "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8",
    "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
    "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1",
    "0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f",
  ],
  [linea.id]: [
    "0xe5d7c2a44ffddf6b295a15c148167daaaf5cf34f",
    "0x176211869ca2b568f2a7d4ee941e073a821ee1ff",
    "0xA219439258ca9da29E9Cc4cE5596924745e12B93",
    "0x4AF15ec2A0BD43Db75dd04E62FAA3B8EF36b00d5",
    "0x3aab2285ddcddad8edf438c1bab47e1a9d05a9b4",
  ],
  [sonic.id]: [
    "0x039e2fb66102314ce7b64ce5ce3e5183bc94ad38",
    "0x29219dd400f2bf60e5a23d13be72b486d4038894",
    "0x0555e30da8f98308edb960aa94c0db47230d2b9c",
    "0x6047828dc181963ba44974801ff68e538da5eaf9",
  ],
  [monad.id]: [
    "0x3bd359c1119da7da1d913d1c4d2b7c461115433a",
    "0x754704bc059f8c67012fed69bc8a327a5aafb603",
  ],
  [sei.id]: [
    "0xe30fedd158a2e3b13e9badaeabafc5516e95e8c7",
    "0x5cf6826140c1c56ff49c808a1a75407cd1df9423",
    "0xe15fc38f6d8c56af07bbcbe3baf5708a2bf42392",
    "0x9151434b16b9763660705744891fa906f660ecc5",
    "0x0555e30da8f98308edb960aa94c0db47230d2b9c",
    "0x160345fc359604fc6e70e3c5facbde5f7a9342d8",
  ],
  [berachain.id]: [
    "0x6969696969696969696969696969696969696969",
    "0x549943e04f40284185054145c6e4e9568c1d3241",
    "0x779ded0c9e1022225f8e0630b35a9b54be713736",
    "0x0555e30da8f98308edb960aa94c0db47230d2b9c",
    "0x2f6f07cdcf3588944bf4c42ac74ff24bf56e7590",
  ],
  [flare.id]: [
    "0x1d80c49bbbcd1c0911346656b529df9e5c2f783d",
    "0x0b38e83b86d491735feaa0a791f65c2b99535396",
  ],
  [avalanche.id]: [
    "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7",
    "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e",
    "0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7",
    "0xa7d7079b0fead91f3e65f86e8915cb59c1a4c664",
    "0xd586e7f844cea2f87f50152665bcbc2c279d8d70",
    "0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab",
  ],
  [katana.id]: [
    "0xee7d8bcfb72bc1880d0cf19822eb0a2e6577ab62",
    "0x203a662b0bd271a6ed5a60edfbd04bfce608fd36",
    "0x2dca96907fde857dd3d816880a0df407eeb2d2f2",
    "0x0913da6da4b42f538b445599b46bb4622342cf52",
    "0x7fb4d0f51544f24f385a421db6e7d4fc71ad8e5c",
  ],
  [optimism.id]: [
    "0x4200000000000000000000000000000000000006",
    "0x7f5c764cbc14f9669b88837ca1490cca17c31607",
    "0x0b2c639c533813f4aa9d7837caf62653d097ff85",
    "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58",
    "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1",
    "0x68f180fcce6836688e9084f035309e29bf0a2095",
  ],
  [mantle.id]: [
    "0x78c1b0c915c4faa5fffa6cabf0219da63d7f4cb8",
    "0x09bc4e0d864854c6afb6eb9a9cdf58ac190d0df9",
    "0x201eba5cc46d216ce6dc03f6a759e8e766e956ae",
    "0x779ded0c9e1022225f8e0630b35a9b54be713736",
    "0xdeaddeaddeaddeaddeaddeaddeaddeaddead1111",
  ],
  [hyperEvmChain.id]: [
    "0x5555555555555555555555555555555555555555",
    "0xb88339cb7199b77e23db6e890353e22632ba630f",
    "0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb",
  ],
  [unichain.id]: [
    "0x4200000000000000000000000000000000000006",
    "0x078d782b760474a361dda0af3839290b0ef57ad6",
    "0x588ce4f028d8e7b53b687865d6a67b3a54c75518",
    "0x9151434b16b9763660705744891fa906f660ecc5",
    "0x927b51f251480a681271180da4de28d44ec4afb8",
  ],
  [xLayer.id]: [
    "0xe538905cf8410324e03a5a23c1c177a474d59b2b",
    "0x74b7f16337b8972027f6196a17a631ac6de26d22",
    "0x1e4a5963abfd975d8c9021ce480b42188849d41d",
    "0x779ded0c9e1022225f8e0630b35a9b54be713736",
    "0x5a77f1443d16ee5761d310e38b62f77f726bc71c",
  ],
  [megaethChain.id]: [
    "0x4200000000000000000000000000000000000006",
    "0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb",
  ],
} satisfies Record<number, string[]>;

export const POPULAR_TOKENS = {
  [bsc.id]: [
    ...BASE_TOKENS[bsc.id],
    "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
  ],
  [polygon.id]: BASE_TOKENS[polygon.id],
  [base.id]: BASE_TOKENS[base.id],
  [mainnet.id]: BASE_TOKENS[mainnet.id],
  [arbitrum.id]: BASE_TOKENS[arbitrum.id],
  [linea.id]: BASE_TOKENS[linea.id],
  [sonic.id]: BASE_TOKENS[sonic.id],
  [monad.id]: BASE_TOKENS[monad.id],
  [sei.id]: BASE_TOKENS[sei.id],
  [berachain.id]: BASE_TOKENS[berachain.id],
  [flare.id]: BASE_TOKENS[flare.id],
  [avalanche.id]: BASE_TOKENS[avalanche.id],
  [katana.id]: BASE_TOKENS[katana.id],
  [optimism.id]: BASE_TOKENS[optimism.id],
  [mantle.id]: BASE_TOKENS[mantle.id],
  [hyperEvmChain.id]: BASE_TOKENS[hyperEvmChain.id],
  [unichain.id]: BASE_TOKENS[unichain.id],
  [xLayer.id]: BASE_TOKENS[xLayer.id],
  [megaethChain.id]: BASE_TOKENS[megaethChain.id],
} satisfies Record<number, string[]>;

export const NATIVE_TOKENS_LOGO_URLS = {
  [bsc.id]: "https://s2.coinmarketcap.com/static/img/coins/128x128/1839.png",
  [polygon.id]:
    "https://s2.coinmarketcap.com/static/img/coins/128x128/3890.png",
  [base.id]: "https://s2.coinmarketcap.com/static/img/coins/128x128/1027.png",
  [mainnet.id]:
    "https://s2.coinmarketcap.com/static/img/coins/128x128/1027.png",
  [arbitrum.id]:
    "https://s2.coinmarketcap.com/static/img/coins/128x128/1027.png",
  [linea.id]: "https://s2.coinmarketcap.com/static/img/coins/128x128/1027.png",
  [sonic.id]: "https://s2.coinmarketcap.com/static/img/coins/128x128/32684.png",
  [monad.id]: "https://s2.coinmarketcap.com/static/img/coins/128x128/30495.png",
  [sei.id]: "https://icons.llamao.fi/icons/chains/rsz_sei",
  [berachain.id]: "https://icons.llamao.fi/icons/chains/rsz_berachain",
  [flare.id]: "https://icons.llamao.fi/icons/chains/rsz_flare",
  [avalanche.id]:
    "https://s2.coinmarketcap.com/static/img/coins/128x128/5805.png",
  [katana.id]: "https://icons.llamao.fi/icons/chains/rsz_katana",
  [optimism.id]:
    "https://s2.coinmarketcap.com/static/img/coins/128x128/1027.png",
  [mantle.id]: "https://icons.llamao.fi/icons/chains/rsz_mantle",
  [hyperEvmChain.id]: "https://icons.llamao.fi/icons/chains/rsz_hyperliquid",
  [unichain.id]: "https://icons.llamao.fi/icons/chains/rsz_unichain",
  [xLayer.id]: "https://icons.llamao.fi/icons/chains/rsz_x-layer",
  [megaethChain.id]:
    "https://s2.coinmarketcap.com/static/img/coins/128x128/1027.png",
} satisfies Record<number, string>;

export const CHAIN_LOGO_URLS = {
  [bsc.id]: "https://icons.llamao.fi/icons/chains/rsz_bsc",
  [polygon.id]: "https://icons.llamao.fi/icons/chains/rsz_polygon",
  [base.id]: "https://icons.llamao.fi/icons/chains/rsz_base",
  [mainnet.id]: "https://icons.llamao.fi/icons/chains/rsz_ethereum",
  [arbitrum.id]: "https://icons.llamao.fi/icons/chains/rsz_arbitrum",
  [linea.id]: "https://icons.llamao.fi/icons/chains/rsz_linea",
  [sonic.id]: "https://icons.llamao.fi/icons/chains/rsz_sonic",
  [monad.id]: "https://icons.llamao.fi/icons/chains/rsz_monad",
  [sei.id]: "https://icons.llamao.fi/icons/chains/rsz_sei",
  [berachain.id]: "https://icons.llamao.fi/icons/chains/rsz_berachain",
  [flare.id]: "https://icons.llamao.fi/icons/chains/rsz_flare",
  [avalanche.id]: "https://icons.llamao.fi/icons/chains/rsz_avalanche",
  [katana.id]: "https://icons.llamao.fi/icons/chains/rsz_katana",
  [optimism.id]: "https://icons.llamao.fi/icons/chains/rsz_optimism",
  [mantle.id]: "https://icons.llamao.fi/icons/chains/rsz_mantle",
  [hyperEvmChain.id]: "https://icons.llamao.fi/icons/chains/rsz_hyperliquid",
  [unichain.id]: "https://icons.llamao.fi/icons/chains/rsz_unichain",
  [xLayer.id]: "https://icons.llamao.fi/icons/chains/rsz_x-layer",
  [megaethChain.id]: "https://icons.llamao.fi/icons/chains/rsz_megaeth",
} satisfies Record<number, string>;

export const DEFAULT_SLIPPAGE = 0.5;

export const DEFAULT_PRICE_PROTECTION = 3;

export const FORM_TABS = [
  {
    label: "Swap",
    value: FormTab.SWAP,
    fullLabel: "Swap",
  },
  {
    label: "TWAP",
    value: FormTab.TWAP,
    fullLabel: "TWAP",
  },
  {
    label: "Limit",
    value: FormTab.LIMIT,
    fullLabel: "Limit",
  },
  {
    label: "SL",
    value: FormTab.STOP_LOSS,
    fullLabel: "Stop Loss",
  },
  {
    label: "TP",
    value: FormTab.TAKE_PROFIT,
    fullLabel: "Take Profit",
  },
] as const;

export const SPOT_TABS = [
  FormTab.TWAP,
  FormTab.LIMIT,
  FormTab.STOP_LOSS,
  FormTab.TAKE_PROFIT,
] as const;
