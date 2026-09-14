"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { MeResult } from "@gai-ara/shared";
import { BrandHeader, Character, Icon } from "@/components/Brand";
import { MiniConnectionGraph } from "@/components/MiniConnectionGraph";

/**
 * 화면 06 — "내가 지금 누구와 어떻게 이어져 있는지 보는" 메인 화면이다.
 * 사람을 초대하는 행동(공유 링크 만들기/복사/공유)은 전부 `/connect`의
 * 역할이고, 여기서는 다시 만들지 않는다 — 두 화면의 역할을 섞지 않는다는
 * 2026-09-14 결정. 더 초대하고 싶으면 그래프 아래 secondary CTA 하나로
 * `/connect`로 보낼 뿐이다.
 *
 * `/r/{token}`(공개 링크로 "몇 다리인지 확인하기") 기능 자체는 그대로
 * 있지만, 그 진입점을 이 화면에 두지 않는다 — 한 화면에 두 종류의 공유
 * 기능을 동시에 넣지 않는다.
 */
export function ResultScreen({ preview = false }: { preview?: boolean }) {
  const router = useRouter();
  const [result, setResult] = useState<MeResult | null>(preview ? {
    distanceCounts: { direct: 2, within2: 4, within3: 6 },
    network: {
      nodes: [
        { id: "p1", parentId: null, depth: 1, displayName: "수연" },
        { id: "p2", parentId: "p1", depth: 2, displayName: null },
        { id: "p3", parentId: "p2", depth: 3, displayName: null },
      ],
      edges: [["p1", "p2"], ["p2", "p3"]],
      hiddenBeyondCount: 0,
    },
    recoveryToken: "preview",
  } : null);
  const [error, setError] = useState<string | null>(null);

  async function handleLogout() {
    if (preview) return;
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/");
  }

  const loadResult = useCallback(async () => {
    const response = await fetch("/api/me/result");
    if (!response.ok) throw new Error("결과를 불러오지 못했어요. 로그인 상태를 확인해주세요.");
    return await response.json() as MeResult;
  }, []);

  useEffect(() => {
    if (preview) return;
    loadResult().then(setResult).catch(() => setError("결과를 불러오지 못했어요. 로그인 상태를 확인해주세요."));
  }, [loadResult, preview]);

  useEffect(() => {
    if (preview) return;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      loadResult().then(setResult).catch(() => {});
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadResult, preview]);

  const isEmpty = result !== null && result.network.nodes.length === 0;

  return <main className="brand-page result-page"><BrandHeader />
    {error ? <><Character kind="search" className="result-character" /><h1 className="upload-heading">결과를 확인할 수 없어요</h1><p className="subtitle" role="alert">{error}</p><Link href="/login" className="primary-button mt-8">다시 로그인하기 <Icon name="arrow" /></Link></>
    : !result ? <section className="analysis-state" role="status"><h1 className="upload-heading">연결을 찾고 있어요</h1><Character kind="search" /><p className="subtitle">결과를 불러오고 있어요…</p><div className="progress-track" /></section>
    : <>
      <MiniConnectionGraph network={result.network} />
      {isEmpty ? <>
        <h1 className="upload-heading cluster-heading">여기서부터 이어져요</h1>
        <p className="subtitle cluster-subtitle">아직 이어진 사람이 없다면<br />아는 사람을 초대해보세요.</p>
        <Link href="/connect" className="text-link text-sm mt-4">아는 사람 초대하기 →</Link>
      </> : <>
        <h1 className="upload-heading cluster-heading">내가 이어진 사람들</h1>
        <Link href="/connect" className="text-link text-sm mt-4">아는 사람 더 초대하기 →</Link>
      </>}
      <section className="result-footer">
        <button type="button" className="text-link text-xs" onClick={handleLogout}>로그아웃</button>
      </section>
</>}
  </main>;
}
