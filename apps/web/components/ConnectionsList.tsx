"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MyPairSummary, ReferralVisit } from "@gai-ara/shared";
import { BrandHeader, Character, Icon } from "@/components/Brand";
import { formatConnectionDiagram, formatConnectionPhrase } from "@/lib/distance-copy";

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

export function ConnectionsList() {
  const [visits, setVisits] = useState<ReferralVisit[] | null>(null);
  const [pairs, setPairs] = useState<MyPairSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<ReferralVisit | null>(null);

  useEffect(() => {
    fetch("/api/referral-link")
      .then(async (response) => (response.ok ? ((await response.json()) as { visits: ReferralVisit[] }).visits : []))
      .then(setVisits)
      .catch(() => setVisits([]));

    fetch("/api/me/pairs")
      .then(async (response) => {
        if (!response.ok) throw new Error("아직 참여 기록이 없어요. 먼저 파일을 업로드해주세요.");
        const data = (await response.json()) as { pairs: MyPairSummary[] };
        return data.pairs;
      })
      .then(setPairs)
      .catch(() => setError("목록을 불러오지 못했어요. 참여 기록과 연결 상태를 확인해주세요."));
  }, []);

  const loading = visits === null && pairs === null && !error;

  if (selectedVisit) {
    const connected = selectedVisit.status === "connected";
    const distance = selectedVisit.distance ?? 1;
    const visitorLabel = selectedVisit.nickname ?? "이름 없는 방문자";
    return (
      <main className="brand-page">
        <header className="brand-header center-logo">
          <button type="button" className="back-button" aria-label="목록으로 돌아가기" onClick={() => setSelectedVisit(null)}>
            <Icon name="back" />
          </button>
          <img className="brand-logo" src="/assets/gai-ara_logo.png" alt="가이 알아?" />
        </header>
        <Character kind={connected ? "wave" : "curious"} className="result-character" />
        {!connected ? (
          <p className="pair-result-title">아직 이어지는 길을 못 찾았어요</p>
        ) : distance <= 1 ? (
          <>
            <p className="pair-result-title">{visitorLabel}과 이미 바로 아는 사이네요</p>
            <p className="pair-result-kicker">다른 사람을 거치지 않고<br />바로 연결되어 있어요.</p>
          </>
        ) : (
          <>
            <p className="pair-result-kicker">{visitorLabel}님과</p>
            <p className="pair-result-title">{formatConnectionPhrase(distance)}</p>
            <p className="connection-diagram" aria-hidden="true">{formatConnectionDiagram(distance)}</p>
            <p className="pair-result-kicker">둘 사이에 {distance - 1}명의 지인이 이어져 있어요.</p>
          </>
        )}
      </main>
    );
  }

  return (
    <main className="brand-page">
      <BrandHeader back />
      <h1 className="upload-heading">내 연결 목록</h1>
      <p className="subtitle mb-6">내 링크로 만난 사람들이에요.</p>

      {error && <p className="error-message" role="alert">{error}</p>}
      {loading && <p className="subtitle">불러오는 중…</p>}

      {!error && visits && visits.length === 0 && (
        <>
          <Character kind="search" className="result-character" />
          <p className="subtitle">아직 내 링크로 만난 사람이 없어요.</p>
        </>
      )}
      {visits && visits.length > 0 && (
        <ul className="referral-visits">
          {visits.map((visit, index) => (
            <li key={index}>
              <button type="button" className="referral-visits-item" onClick={() => setSelectedVisit(visit)}>
                <span>{visit.nickname ?? "이름 없는 방문자"}</span>
                <span>{visit.status === "unreachable" ? "다리를 못 찾았어요" : formatConnectionPhrase(visit.distance ?? 1)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {pairs && pairs.length > 0 && (
        <section className="mt-8 border-t border-ink/10 pt-6">
          <h2 className="font-bold text-deep-green">1:1 링크</h2>
          <ul className="connections-list mt-3">
            {pairs.map((pair) => (
              <li key={pair.token}>
                <Link href={`/pair/${pair.token}`} className="connections-list-item">
                  <span className="connections-list-label">{displayLabel(pair)}</span>
                  <span className="connections-list-status">{statusLabel(pair)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
