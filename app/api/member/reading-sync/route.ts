import { handleMemberReadingSyncGet, handleMemberReadingSyncPost } from "@/lib/member-reading-sync/api-handlers";

export const runtime = "nodejs";

export async function GET(req: Request) {
  console.log(`[reading-sync] GET ${new Date().toISOString()}`);
  return handleMemberReadingSyncGet(req);
}

export async function POST(req: Request) {
  console.log(`[reading-sync] POST ${new Date().toISOString()}`);
  return handleMemberReadingSyncPost(req);
}
