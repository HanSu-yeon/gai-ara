import LoginScreen from "@/components/LoginScreen";
import { normalizeReturnTo } from "@/lib/return-to";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const value = (await searchParams).returnTo;
  const returnTo = normalizeReturnTo(typeof value === "string" ? value : null);
  return <LoginScreen returnTo={returnTo} />;
}
