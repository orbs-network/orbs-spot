export function transactionErrorMessage(message = "") {
  if (/confirmation|accepted|check.*history|check.*wallet activity/i.test(message))
    return "Confirmation is unavailable. Check your activity or the explorer before trying again; the submission may have succeeded.";
  if (/insufficient|balance|funds/i.test(message)) return "There isn’t enough balance to cover the amount and network fees.";
  if (/wallet.*changed|account.*changed|network.*changed/i.test(message)) return "Your wallet or network changed. Review the details again before continuing.";
  if (/quote|price/i.test(message)) return "The price is unavailable or expired. Return to the review to request a fresh quote.";
  if (/allowance|approval/i.test(message)) return "Token approval couldn’t be confirmed. Check your wallet before trying again.";
  if (/revert|transaction failed/i.test(message)) return "The transaction was reverted. Check the explorer for details before trying again.";
  return "We couldn’t complete this request. Check your connection and wallet activity before trying again.";
}
