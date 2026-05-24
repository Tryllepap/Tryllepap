import { NextResponse } from "next/server";
import { getAllLobbies } from "@/lib/lobbies";

export async function GET() {
  try {
    const lobbies = await getAllLobbies();
    // Strip password hashes before sending to client
    const safe = lobbies.map(({ passwordHash, ...rest }) => ({
      ...rest,
      hasPassword: passwordHash !== null,
    }));
    return NextResponse.json(safe);
  } catch (err) {
    console.error("[lobbies/list]", err);
    return NextResponse.json({ error: "Failed to fetch lobbies." }, { status: 500 });
  }
}
