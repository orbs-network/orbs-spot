/** Keep the useful error text, omitting wallet request dumps and SDK metadata. */
export function formatSubmissionError(message?: string): string {
  const raw = message?.trim();
  if (!raw) return "The transaction could not be submitted. Please try again.";
  const pendingNotice = raw.match(/Check order history before retrying; the order may have been accepted\./i)?.[0];
  const details = raw.match(/(?:^|\n)\s*Details:\s*([^\n]+)/i)?.[1];
  const summary = details ?? raw.split(/\n\s*(?:Request Arguments|Request body|Raw Call Arguments|Contract Call|Docs:|Version:|Stack:)/i)[0];
  const readable = summary
    .replace(/^error:\s*/i, "")
    .replace(/,\s*code:\s*\d+(?=\.|$)/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return pendingNotice && !readable.includes(pendingNotice)
    ? `${readable} ${pendingNotice}`
    : readable;
}
