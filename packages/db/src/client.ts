import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let cached: ReturnType<typeof drizzle<typeof schema>> | undefined;

/**
 * lazy singleton. Next.js dev 서버의 hot-reload 시 커넥션이 계속
 * 늘어나는 것을 막기 위해 모듈 스코프 캐시를 사용한다.
 */
export function getDb() {
  if (cached) return cached;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL 환경 변수가 설정되어 있지 않습니다.");
  }

  const client = postgres(connectionString, { max: 10 });
  cached = drizzle(client, { schema });
  return cached;
}
