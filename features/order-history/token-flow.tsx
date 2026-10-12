import { ArrowRightIcon } from "lucide-react";
import { makeEllipsisAddress } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import styles from "./token-flow.module.css";

type TokenInfo = { symbol?: string; address: string; loading?: boolean };
function Token({ token }: { token: TokenInfo }) {
  if (token.loading) return <div className={styles.value}><Skeleton className="h-4 w-12 max-w-full" aria-label="Loading token" /></div>;
  return <div className={styles.value}><span title={token.address}>{token.symbol ?? makeEllipsisAddress(token.address)}</span></div>;
}

export function TokenFlow({ input, output }: { input: TokenInfo; output: TokenInfo }) {
  return <div className={styles.flow} data-token-flow>
    <Token token={input} /><ArrowRightIcon aria-hidden="true" className={styles.arrow} /><Token token={output} />
  </div>;
}
