"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { AcquaintanceLink } from "@gai-ara/shared";
import { BrandHeader, Character } from "@/components/Brand";
import { trackEvent } from "@/lib/analytics";
import { loginPathFor } from "@/lib/return-to";

/**
 * 화면 03(지인 연결) — 재사용 가능한 지인 링크를 공유한다. `POST
 * /api/links`는 호출할 때마다 기존 유효 링크를 폐기하고 새로 만들기
 * 때문에, `GET /api/links`로 기존 링크를 먼저 확인해 있으면 그대로
 * 보여주고(회전 없음), 없거나 더 쓸 수 없을 때만(404) 자동으로 한 번 만든다 — 승인된
 * 화면 카피에 별도 "만들기" 버튼이 없어 방문 즉시 공유 버튼을 보여준다
 * (§apps/web/lib/acquaintance-links.ts 참고).
 */
export default function ConnectScreen() {
  const router = useRouter();
  const [link, setLink] = useState<AcquaintanceLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // 승인된 화면 03 카피는 별도 "만들기" 버튼 없이 바로 공유 버튼을
    // 보여준다 — 기존 링크가 없으면(404) 자동으로 하나 만든다. 이미 유효한
    // 링크가 있으면 그걸 그대로 보여줄 뿐 회전시키지 않는다(재발급은
    // `POST /api/links`를 다시 호출하는 별도 동작이라 여기서는 하지 않는다).
    fetch("/api/links")
      .then(async (response) => {
        if (response.status === 401) {
          router.replace(loginPathFor("/connect"));
          return;
        }
        if (response.ok) {
          setLink((await response.json()) as AcquaintanceLink);
          setLoading(false);
          return;
        }
        if (response.status === 404) {
          const created = await fetch("/api/links", { method: "POST" });
          if (created.status === 401) {
            router.replace("/login");
            return;
          }
          if (created.ok) {
            setLink((await created.json()) as AcquaintanceLink);
            trackEvent("acquaintance_link_create");
          } else {
            setError("링크를 만들지 못했어요. 잠시 후 다시 시도해주세요.");
          }
        }
        setLoading(false);
      })
      .catch(() => {
        setError("링크를 만들지 못했어요. 잠시 후 다시 시도해주세요.");
        setLoading(false);
      });
  }, [router]);

  const inviteUrl = link ? `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${link.token}` : "";

  async function handleCopy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("자동 복사가 되지 않아요. 링크를 길게 눌러 직접 복사해주세요.");
    }
  }

  /**
   * 실제 카카오톡 공유 SDK(JS 키)는 이번 범위가 아니다 — 로그인용
   * REST API 키(`KAKAO_CLIENT_ID`)와는 다른 별도의 앱 설정이 필요해서
   * 새 외부 연동을 추가하지 않는다. 대신 브라우저 표준 Web Share API를
   * 쓰고, 지원하지 않으면 링크 복사로 대체한다.
   */
  async function handleShare() {
    if (!link) return;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ url: inviteUrl, title: "가이 알아?" });
        return;
      } catch {
        // 사용자가 공유를 취소한 경우 등 — 조용히 복사로 대체한다.
      }
    }
    await handleCopy();
  }

  return (
    <main className="brand-page">
      <BrandHeader home />
      <Character kind="default" className="result-character" />
      <h1 className="upload-heading">
        실제로 아는 사람에게<br />이 링크를 보내보세요.
      </h1>
      <p className="subtitle">서로 아는 사이라고 확인하면 바로 이어져요.</p>

      {loading && <p className="subtitle mt-4">불러오는 중…</p>}

      {link && (
        <>
          <button type="button" className="primary-button mt-6" onClick={handleShare}>
            공유하기
          </button>
          <button type="button" className="text-link text-sm mt-3" onClick={handleCopy}>
            {copied ? "✓ 링크 복사됨" : "링크 복사"}
          </button>
        </>
      )}

      {error && <p className="error-message" role="alert">{error}</p>}

      <div className="acquaintance-link-note">
        <strong>실제로 아는 사람에게만 보내주세요.</strong>
      </div>
      <Link href="/result" className="text-link text-xs mt-4">이어진 사람 보기 →</Link>
    </main>
  );
}
