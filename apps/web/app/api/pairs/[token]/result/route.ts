import { NextResponse } from "next/server";
import { computePairResult } from "@/lib/graph-service";
import { getInviteByToken, upsertPairResult } from "@/lib/invites";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const invite = await getInviteByToken(token);

  if (!invite) {
    return NextResponse.json({ error: "존재하지 않는 링크예요." }, { status: 404 });
  }

  const result = await computePairResult(
    invite.inviterParticipantId,
    invite.recipientParticipantId,
  );

  if (invite.status === "accepted") {
    await upsertPairResult(invite.id, result.distance);
  }

  return NextResponse.json(result);
}
