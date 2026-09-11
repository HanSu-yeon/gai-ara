"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MyPairSummary } from "@gai-ara/shared";
import { BrandHeader, Character } from "@/components/Brand";
import { formatConnectionPhrase } from "@/lib/distance-copy";

function statusLabel(pair: MyPairSummary): string {
  if (pair.status === "pending") return "상대방을 기다리는 중";
  if (pair.status === "expired") return "만료됨";
  if (pair.distance === null) return "아직 이어지는 길을 못 찾았어요";
  return formatConnectionPhrase(pair.distance);
}

function displayLabel(pair: MyPairSummary): string {
  if (pair.role === "inviter") return pair.label ?? "이름 없는 초대";
  return pair.inviterNickname ? `${pair.inviterNickname}님이 보낸 링크` : "받은 링크";
}

/**
 * 링크를 잃어버려도(카톡 삭제 등) 세션이 살아있는 동안은 다시 확인할 수
 * 있게 하는 "내 연결 목록" 화면. label은 inviter 자신이 남긴 메모일 때만
 * 보인다 — 상대방 신원은 어디에도 없다.
 */
export function ConnectionsList() {
  const [pairs, setPairs] = useState<MyPairSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me/pairs")
      .then(async (response) => {
        if (!response.ok) throw new Error("아직 참여 기록이 없어요. 먼저 파일을 업로드해주세요.");
        const data = (await response.json()) as { pairs: MyPairSummary[] };
        return data.pairs;
      })
      .then(setPairs)
      .catch(() => setError("목록을 불러오지 못했어요. 참여 기록과 연결 상태를 확인해주세요."));
  }, []);

  return (
    <main className="brand-page">
      <BrandHeader back />
      <h1 className="upload-heading">내 연결 목록</h1>
      <p className="subtitle mb-6">내가 만들었거나 받은 링크들이에요.</p>

      {error && <p className="error-message" role="alert">{error}</p>}
      {!error && !pairs && <p className="subtitle">불러오는 중…</p>}
      {!error && pairs && pairs.length === 0 && (
        <>
          <Character kind="search" className="result-character" />
          <p className="subtitle">아직 만들었거나 받은 링크가 없어요.</p>
        </>
      )}
      {pairs && pairs.length > 0 && (
        <ul className="connections-list">
          {pairs.map((pair) => (
            <li key={pair.token}>
              <Link href={`/pair/${pair.token}`} className="connections-list-item">
                <span className="connections-list-label">{displayLabel(pair)}</span>
                <span className="connections-list-status">{statusLabel(pair)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
