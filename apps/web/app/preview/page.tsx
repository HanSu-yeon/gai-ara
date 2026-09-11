import { redirect } from "next/navigation";
import { UnreachableResult } from "@/components/UnreachableResult";

export default async function PreviewPage({ searchParams }: {
  searchParams: Promise<{ screen?: string | string[] }>;
}) {
  if ((await searchParams).screen === "result-no") return <UnreachableResult />;
  redirect("/");
}
