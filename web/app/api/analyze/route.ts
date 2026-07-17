import { NextResponse } from "next/server";
import { analyzeEvidence } from "@/lib/analyzer";
import { searchWeb } from "@/lib/brave";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { claim?: unknown };
    const claim = typeof body.claim === "string" ? body.claim.trim() : "";

    if (claim.length < 5) {
      return NextResponse.json(
        { error: "確認したい情報を5文字以上で入力してください。" },
        { status: 400 },
      );
    }
    if (claim.length > 500) {
      return NextResponse.json(
        { error: "入力は500文字以内にしてください。長文は主張を1つに分けてください。" },
        { status: 400 },
      );
    }

    const results = await searchWeb(claim);
    const analysis = analyzeEvidence(claim, results);
    return NextResponse.json(analysis, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラーが発生しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
