import { handleMemberReadingSyncGet, handleMemberReadingSyncPost } from "@/lib/member-reading-sync/api-handlers";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return handleMemberReadingSyncGet(req);
}

export async function POST(req: Request) {
  return handleMemberReadingSyncPost(req);
}
