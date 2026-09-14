import { BrandHeader } from "@/components/Brand";

const CONTACT_EMAIL = "hansuyeon.dev@gmail.com";
const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("[가이 알아?] 문의")}&body=${encodeURIComponent(
  "삭제를 원하시면 아래 정보를 알려주세요. 다른 문의는 자유롭게 적어주셔도 돼요.\n\n- 카카오 로그인에 사용한 계정(본인 확인용, 카카오 고유 회원번호는 몰라도 됩니다): \n- 서비스에서 정한 표시 이름: \n",
)}`;

export const metadata = { title: "개인정보처리방침 · 가이 알아?" };

export default function PrivacyPolicyPage() {
  return (
    <main className="brand-page privacy-page">
      <BrandHeader back />
      <article>
        <h1 className="upload-heading">개인정보처리방침</h1>
        <p className="subtitle">시행일 2026-09-12 · 최종 수정일 2026-09-13</p>

        <h2>1. 수집하는 정보</h2>
        <ul>
          <li>카카오 로그인 고유 회원번호와 직접 입력한 표시 이름. 이메일·전화번호·프로필 사진은 받지 않습니다. 표시 이름은 일부 기능(챌린지 결과 등)에서 다른 이용자에게 보일 수 있으며, 이름을 처음 설정하실 때 안내해드립니다.</li>
          <li>지인 확인 기록과 공개 링크 방문 기록(연결 결과).</li>
          <li>로그인 유지용 세션 쿠키(7일 후 만료)와 Google Analytics 이용 통계.</li>
        </ul>

        <h2>2. 이용 목적과 보관 기간</h2>
        <p>
          관계 확인, 거리 계산, 결과 제공에 사용합니다. 삭제 요청 전까지 보관하며,
          세션 쿠키는 7일 후 만료됩니다.
        </p>

        <h2>3. 외부 서비스 이용</h2>
        <p>
          Vercel(호스팅), 데이터베이스 인프라, 카카오(로그인), Google Analytics(이용 통계)를
          이용하며, 정보를 판매하거나 광고 목적으로 이용하지 않습니다.
        </p>

        <h2>4. 문의 및 삭제 요청</h2>
        <p>
          언제든 본인 정보의 열람·정정·삭제를 요청할 수 있습니다. 아래 이메일로
          카카오 로그인 계정 정보나 표시 이름을 알려주시면 확인 후 처리합니다.
        </p>
        <a className="guide-button mt-6" href={CONTACT_MAILTO}>문의·삭제 요청은 이메일로</a>
      </article>
    </main>
  );
}
