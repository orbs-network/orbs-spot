import { notFound } from "next/navigation";
import { isAddress } from "viem";
import { SPOT_CHAINS } from "@/lib/consts";
import { OrderDetailPage } from "@/features/order-history/order-page";

export const metadata = { title: "Order details | Orbs" };

export default async function OrderPage({ params, searchParams }: {
  params: Promise<{ chainId: string; orderId: string }>;
  searchParams: Promise<{ account?: string | string[] }>;
}) {
  const { chainId: chain, orderId: encodedOrderId } = await params;
  let orderId: string;
  try {
    orderId = decodeURIComponent(encodedOrderId);
  } catch {
    notFound();
  }
  const { account } = await searchParams;
  const chainId = Number(chain);
  if (!SPOT_CHAINS.some(network => String(network.id) === chain) || !orderId || orderId.length > 512) notFound();
  if (account !== undefined && (typeof account !== "string" || !isAddress(account))) notFound();

  return <OrderDetailPage chainId={chainId} orderId={orderId} account={account} />;
}
