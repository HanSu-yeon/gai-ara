import { BrandHeader } from "@/components/Brand";

const CONTACT_EMAIL = "hansuyeon.dev@gmail.com";
const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("[가이 알아?] 문의")}&body=${encodeURIComponent(
  "삭제를 원하시면 아래 정보를 알려주세요. 다른 문의는 자유롭게 적어주셔도 돼요.\n\n- Instagram 아이디: \n- (또는) 내 결과 저장 링크(/result/로 시작하는 링크): \n",
)}`;

export const metadata = { title: "개인정보처리방침 · 가이 알아?" };

export default function PrivacyPolicyPage() {
  return (
    <main className="brand-page privacy-page">
      <BrandHeader back />
      <article>
        <h1 className="upload-heading">개인정보처리방침</h1>
        <p className="subtitle">시행일 · 최종 수정일 2026-09-12</p>

        <h2>1. 수집하는 정보</h2>
        <ul>
          <li>
            내 Instagram 아이디와 팔로잉 계정 아이디를 서버로 보내 해시값으로 저장합니다.
            팔로잉 목록에는 서비스에 참여하지 않은 계정도 포함됩니다.
          </li>
          <li>
            결과를 다시 보기 위한 세션 쿠키·복구 링크, 선택 입력한 닉네임과 연결 결과를 저장합니다.
            닉네임은 상대에게 표시되며, 복구 링크는 다른 사람에게 공유하지 마세요.
          </li>
          <li>
            Google Analytics로 페이지 조회·버튼 클릭 기록, 쿠키 식별자와 기기·브라우저 정보를
            처리합니다. 쿠키는 브라우저 설정에서 차단하거나 삭제할 수 있습니다.
          </li>
        </ul>
        <p>
          원본 ZIP/JSON 파일은 브라우저에서만 처리합니다. Instagram 비밀번호, 팔로워 목록,
          게시물·프로필 정보는 수집하지 않습니다. 아이디 원문은 데이터베이스에 저장하지 않으며,
          해시값도 개인정보로 보고 보호합니다.
        </p>

        <h2>2. 이용 목적과 보관 기간</h2>
        <p>
          맞팔 관계와 연결 거리 계산, 결과 제공·복구, 초대 기능과 이용 통계에 사용합니다.
          참여 정보는 삭제 요청 전까지 보관하며 자동 삭제 기간은 정해져 있지 않습니다.
          다시 업로드하면 팔로잉 목록을 교체하고, 세션 쿠키는 7일 후 만료됩니다.
        </p>

        <h2>3. 외부 서비스 이용</h2>
        <p>
          서비스 운영을 위해 Vercel(호스팅), 데이터베이스 인프라 제공업체, Google Analytics(이용 통계)를
          이용합니다. 정보를 판매하거나 광고·제3자 마케팅 목적으로 이용하지 않습니다.
        </p>

        <h2>4. 문의 및 삭제 요청</h2>
        <p>
          참여 여부와 관계없이 본인 정보의 열람·정정·삭제를 요청할 수 있습니다.
          아래 이메일로 Instagram 아이디 또는 내 결과 저장 링크를 보내주시면,
          본인 확인 후 처리하고 결과를 안내합니다.
        </p>
        <a className="guide-button mt-6" href={CONTACT_MAILTO}>문의·삭제 요청은 이메일로</a>
      </article>
    </main>
  );
}
