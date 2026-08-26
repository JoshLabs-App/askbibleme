import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SCHEMA_VERSION = 1;

Deno.serve(async (req) => {
  if (req.method !== "DELETE" && req.method !== "POST") {
    return Response.json(
      { ok: false, schemaVersion: SCHEMA_VERSION, error: "method_not_allowed", code: "method_not_allowed" },
      { status: 405 },
    );
  }

  const auth = req.headers.get("Authorization")?.trim() ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) {
    return Response.json(
      { ok: false, schemaVersion: SCHEMA_VERSION, error: "unauthorized", code: "unauthorized" },
      { status: 401 },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceRole) {
    return Response.json(
      {
        ok: false,
        schemaVersion: SCHEMA_VERSION,
        error: "Supabase 未配置",
        code: "supabase_not_configured",
      },
      { status: 503 },
    );
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: auth } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user?.id) {
    return Response.json(
      { ok: false, schemaVersion: SCHEMA_VERSION, error: "unauthorized", code: "unauthorized" },
      { status: 401 },
    );
  }

  const admin = createClient(supabaseUrl, serviceRole);
  const userId = userData.user.id;

  const { data: profile } = await admin
    .from("askbible_profiles")
    .select("is_admin")
    .eq("user_id", userId)
    .maybeSingle();
  if (profile?.is_admin) {
    return Response.json(
      {
        ok: false,
        schemaVersion: SCHEMA_VERSION,
        error: "管理员账号无法在此注销。",
        code: "admin_account",
      },
      { status: 403 },
    );
  }

  await admin.from("member_reading_sync_documents").delete().eq("user_id", userId);

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    const message = deleteError.message || "删除失败";
    if (/not found/i.test(message)) {
      return Response.json(
        { ok: false, schemaVersion: SCHEMA_VERSION, error: "账号不存在。", code: "not_found" },
        { status: 404 },
      );
    }
    return Response.json(
      { ok: false, schemaVersion: SCHEMA_VERSION, error: message, code: "delete_failed" },
      { status: 500 },
    );
  }

  return Response.json({ ok: true, schemaVersion: SCHEMA_VERSION });
});
