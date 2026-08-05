import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { logNadiaAudit } from "@/lib/super-admin/nadia-audit";
import { loadNadiaSettings, saveNadiaSettings } from "@/lib/super-admin/nadia-load";
import {
  costHintForMode,
  nadiaSettingsSchema,
} from "@/lib/super-admin/nadia-settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  await requirePlatformAdmin();
  const settings = await loadNadiaSettings();
  return NextResponse.json({
    settings,
    costHint: costHintForMode(settings.reply_mode),
  });
}

export async function PATCH(request: Request) {
  const admin = await requirePlatformAdmin();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed: z.infer<typeof nadiaSettingsSchema>;
  try {
    parsed = nadiaSettingsSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: e.issues },
        { status: 400 },
      );
    }
    throw e;
  }

  const settings = {
    reply_mode: parsed.reply_mode,
    voice_auto_play: parsed.voice_auto_play ?? true,
  };
  await saveNadiaSettings(settings);

  await logNadiaAudit({
    adminUserId: admin.userId,
    adminEmail: admin.email,
    action: "nadia.settings_updated",
    diff: settings,
  });

  return NextResponse.json({
    settings,
    costHint: costHintForMode(settings.reply_mode),
  });
}
