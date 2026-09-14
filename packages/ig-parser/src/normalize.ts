/**
 * Instagram username 정규화.
 * "@handle", " Handle ", "HANDLE" 이 모두 같은 계정을 가리키도록 통일한다.
 */
export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@/, "").toLowerCase();
}

/**
 * Instagram data export의 followers_*.json / following.json은 버전에 따라
 * 다음처럼 구조가 조금씩 다르다.
 *
 *   [ { "string_list_data": [ { "value": "someone", "href": "...", "timestamp": 0 } ] } ]
 *   { "relationships_following": [ { "string_list_data": [ ... ] } ] }
 *
 * 특정 구조 하나에 의존하면 Meta가 export 형식을 바꿀 때마다 parser가 깨지므로,
 * JSON 트리를 재귀적으로 훑어서 `string_list_data[].value` 형태의 문자열을
 * 전부 모으고, value가 없는 새 following 형식은 같은 항목의 title을 사용한다. 알 수 없는 wrapper 객체/배열이 추가되어도
 * 이 방식은 계속 동작한다.
 */
export function extractUsernames(node: unknown): string[] {
  const found: string[] = [];

  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }

    if (value !== null && typeof value === "object") {
      const record = value as Record<string, unknown>;

      const stringListData = record["string_list_data"];
      if (Array.isArray(stringListData)) {
        const before = found.length;
        for (const entry of stringListData) {
          if (
            entry !== null &&
            typeof entry === "object" &&
            typeof (entry as Record<string, unknown>)["value"] === "string" &&
            ((entry as Record<string, unknown>)["value"] as string).trim().length > 0
          ) {
            found.push((entry as Record<string, unknown>)["value"] as string);
          }
        }
        if (found.length === before && typeof record.title === "string" && /^[A-Za-z0-9._]{1,30}$/.test(record.title)) {
          found.push(record.title);
        }
      }

      for (const key of Object.keys(record)) {
        // string_list_data는 이미 처리했으니 중복 방문만 피한다.
        if (key === "string_list_data") continue;
        visit(record[key]);
      }
    }
  };

  visit(node);
  return found;
}
