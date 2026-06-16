import {
  infoEditionV3BatchGetResponse,
  infoEditionV3BatchPostResponse,
} from "@/lib/bible/info-edition-v3-batch-handlers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  return infoEditionV3BatchGetResponse(process.cwd(), req);
}

export async function POST(req: Request) {
  return infoEditionV3BatchPostResponse(process.cwd(), req);
}
