export const SIGNATURE_FIELD_EXPLANATIONS: Record<string, string> = {
  signature:
    "The complete 65-byte EIP-712 signature returned directly by the wallet.",
  chainId:
    "The active chain selected by the DEX. It is used to fetch and validate protocol configuration.",
  tokenAddress:
    "The DEX-derived ERC-20 input address authorized by RePermit. Use WToken when the user selected native input.",
  inputTokenAddress:
    "The DEX-derived ERC-20 address consumed by each fill. Native input is unsupported, so this must be WToken.",
  requiredAmount:
    "The total input amount calculated by the DEX, expressed in the token's smallest unit.",
  message: "The complete EIP-712 RePermit order message that the wallet signs.",
  "message.permitted":
    "The token permission covered by this signature, including its token and maximum amount.",
  "message.permitted.token":
    "The source token contract authorized by the RePermit signature.",
  "message.permitted.amount":
    "The maximum source-token amount authorized by this signature, in the token's smallest unit.",
  "message.spender":
    "The signed reactor returned by configuration. ERC-20 allowance targets domain.verifyingContract instead.",
  "message.nonce":
    "A unique value that prevents this signed permission from being replayed.",
  "message.deadline":
    "The Unix timestamp, in seconds, after which the signed permission expires.",
  "message.witness":
    "The execution rules bound to the token permission as the signed order witness.",
  "message.witness.reactor":
    "The reactor contract that validates and processes this order.",
  "message.witness.executor":
    "The executor contract authorized to execute the order.",
  "message.witness.exchange":
    "Exchange-routing and fee metadata used when a fill is executed.",
  "message.witness.exchange.adapter":
    "The adapter contract used to route the token exchange.",
  "message.witness.exchange.ref":
    "The referral or fee-recipient address associated with the exchange.",
  "message.witness.exchange.share":
    "The configured referral fee share. Zero means no referral share is applied.",
  "message.witness.exchange.data":
    "Optional adapter-specific calldata. 0x means no extra adapter data is supplied.",
  "message.witness.swapper":
    "The wallet that owns the input tokens and signs the order.",
  "message.witness.nonce":
    "The order nonce used to uniquely identify the witness and prevent replay.",
  "message.witness.start":
    "The Unix timestamp, in seconds, from which the order may begin executing.",
  "message.witness.deadline":
    "The Unix timestamp, in seconds, after which the order can no longer execute.",
  "message.witness.chainid": "The EVM chain ID on which this order is valid.",
  "message.witness.exclusivity":
    "The order's exclusive-execution constraint. Zero means no exclusivity window is configured.",
  "message.witness.epoch":
    "The delay between eligible fills, expressed in seconds. Zero allows a single immediate fill.",
  "message.witness.slippage":
    "The price-protection tolerance in basis points; 100 basis points equals 1%.",
  "message.witness.freshness":
    "The maximum freshness window used when validating execution data, in seconds.",
  "message.witness.input":
    "The source-token amounts and limits applied to each order fill.",
  "message.witness.input.token":
    "The source token contract supplied to each fill.",
  "message.witness.input.amount":
    "The source-token amount allocated to one fill, in the token's smallest unit.",
  "message.witness.input.maxAmount":
    "The maximum total source-token amount that may be consumed by the order.",
  "message.witness.output":
    "The destination token, minimum output, trigger thresholds, and recipient for each fill.",
  "message.witness.output.token":
    "The destination token contract the order receives.",
  "message.witness.output.limit":
    "The minimum destination-token amount accepted per fill, in the token's smallest unit.",
  "message.witness.output.triggerLower":
    "The lower trigger threshold. It is populated for stop-loss orders and otherwise set to zero.",
  "message.witness.output.triggerUpper":
    "The upper trigger threshold. It is populated for take-profit orders and otherwise set to zero.",
  "message.witness.output.recipient":
    "The wallet that receives destination tokens from completed fills.",
  domain:
    "Server-controlled EIP-712 domain. Preserve it unchanged when signing.",
  "domain.name": "Server-controlled EIP-712 domain name.",
  "domain.version": "Server-controlled EIP-712 domain version.",
  "domain.chainId":
    "Configured EVM chain ID. It must match the connected chain and witness.chainid.",
  "domain.verifyingContract":
    "RePermit contract that verifies the signature and receives ERC-20 allowance.",
  primaryType:
    "Root EIP-712 type returned by the service; pass it to the wallet unchanged.",
  types:
    "Complete server-controlled EIP-712 type map; pass it to the wallet unchanged.",
  partner: "Partner identifier resolved by the configuration service.",
};
