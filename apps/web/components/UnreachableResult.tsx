"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandHeader, Character, Icon } from "@/components/Brand";

/** Render when the pair result status is `unreachable`. */
export function UnreachableResult() {
  const [message, setMessage] = useState("");
  const [sharing, setSharing] = useState(false);

  async function shareResult() {
    setSharing(true);
    setMessage("");
    const text = `가이 알아? 아직 이어지는 길을 못 찾았어요. 지금 참여한 사람들 사이에서는 둘을 잇는 연결이 아직 없어요. ${window.location.origin} 에서 확인해보세요!`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "가이 알아? 연결 결과", text });
      } else {
        await navigator.clipboard.writeText(text);
        setMessage("결과 문구를 복사했어요. 친구에게 보내보세요!");
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) {
        setMessage("공유하지 못했어요. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setSharing(false);
    }
  }

  return <main className="brand-page unreachable-page">
    <BrandHeader home />
    <section className="unreachable-content" aria-labelledby="unreachable-title">
      <h1 id="unreachable-title">아직 이어지는 길을<br /><em>못 찾았어요</em></h1>
      <p className="subtitle">지금 참여한 사람들 사이에서는<br />둘을 잇는 연결이 아직 없어요.</p>
      <div className="unreachable-art" role="img" aria-label="두 귤 캐릭터 사이에 아직 연결되지 않은 길과 물음표">
        <svg viewBox="0 0 400 180" fill="none" aria-hidden="true">
          <path d="M70 105H330" stroke="#b9d5b8" strokeWidth="2" strokeDasharray="3 5" strokeLinecap="round" />
          {[140, 260].map(x => <g key={x} transform={`translate(${x} 105)`}>
            <circle r="18" fill="#e9f2e3" />
            <circle cy="-5" r="4.5" fill="#8dbe94" />
            <path d="M-7 8v-3a7 7 0 0 1 14 0v3z" fill="#8dbe94" />
          </g>)}
          <circle cx="200" cy="105" r="20" fill="#fdfbf5" stroke="#deddd4" strokeWidth="1.5" strokeDasharray="4 4" />
          <text x="200" y="115" textAnchor="middle" fill="#c9c8bf" fontSize="29" fontWeight="700">?</text>
          <path d="M200 61V51m-14 15-5-8m33 8 5-8" stroke="#ffd4ac" strokeWidth="3.5" strokeLinecap="round" />
        </svg>
        <Character kind="curious" className="unreachable-character left" />
        <Character kind="curious" className="unreachable-character right" />
      </div>
      <Link href="/result" className="primary-button unreachable-invite">
        <Icon name="link" />
        <span><small>다른 사람에게도 보내볼까요?</small>내 링크 확인하기</span>
        <Icon name="arrow" />
      </Link>
      <button className="unreachable-share" onClick={shareResult} disabled={sharing}>
        <Icon name="upload" />{sharing ? "공유하는 중…" : "결과 공유하기"}
      </button>
      <p className="result-note" role="status">{message}</p>
    </section>
  </main>;
}
