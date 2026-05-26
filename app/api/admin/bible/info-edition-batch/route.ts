import {
  infoEditionBatchGetResponse,
  infoEditionBatchPostResponse,
} from "@/lib/bible/info-edition-v1-batch-handlers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  return infoEditionBatchGetResponse(process.cwd(), { requireOnlineFlag: true });
}

export async function POST(req: Request) {
  return infoEditionBatchPostResponse(process.cwd(), req, { requireOnlineFlag: true });
}
