import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import webpush from "web-push";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdminAccess } from "./session.server";

const sendPushSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  url: z.string().default("/app"),
  gameId: z.string().uuid().optional(),
  playerIds: z.array(z.string().uuid()).optional(),
});

export const sendPushNotifications = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => sendPushSchema.parse(d))
  .handler(async ({ data }) => {
    await requireAdminAccess();

    const vapidSubject = process.env.VAPID_SUBJECT;
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

    if (!vapidSubject || !vapidPublicKey || !vapidPrivateKey) {
      throw new Error("Chaves VAPID não configuradas no servidor.");
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    let query = supabaseAdmin
      .from("push_subscriptions")
      .select("id, player_id, endpoint, p256dh, auth");

    if (data.playerIds?.length) {
      query = query.in("player_id", data.playerIds);
    }

    const { data: subscriptions, error } = await query;
    if (error) throw new Error(error.message);

    if (!subscriptions || subscriptions.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const payload = JSON.stringify({
      title: data.title,
      body: data.body,
      icon: "/icon-192x192.png",
      badge: "/icon-96x96.png",
      tag: data.gameId ? `game-${data.gameId}` : "fdv-general",
      url: data.url,
      gameId: data.gameId,
      sound: "/notification-sound.mp3",
    });

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
        ),
      ),
    );

    const staleSubscriptionIds: string[] = [];
    let sent = 0;
    let failed = 0;

    results.forEach((result, idx) => {
      if (result.status === "fulfilled") {
        sent += 1;
        return;
      }
      failed += 1;
      const statusCode = (result.reason as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        staleSubscriptionIds.push(subscriptions[idx].id);
      }
    });

    if (staleSubscriptionIds.length > 0) {
      await supabaseAdmin.from("push_subscriptions").delete().in("id", staleSubscriptionIds);
    }

    return { sent, failed };
  });
