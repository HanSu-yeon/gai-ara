import { NextResponse } from "next/server";
import { computeMeResult } from "@/lib/graph-service";
import { getSessionParticipantId } from "@/lib/session";

export async function GET() {
  const participantId = await getSessionParticipantId();
  if (!participantId) {
    return NextResponse.json({ error: "아직 참여 기록이 없어요." }, { status: 401 });
  }

  const result = await computeMeResult(participantId);
  return NextResponse.json(result);
}
