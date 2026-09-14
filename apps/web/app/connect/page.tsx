import ConnectScreen from "@/components/ConnectScreen";
import { normalizeReturnTo } from "@/lib/return-to";

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const value = (await searchParams).returnTo;
  const returnTo = normalizeReturnTo(typeof value === "string" ? value : null);
  return <ConnectScreen returnTo={returnTo} />;
}
