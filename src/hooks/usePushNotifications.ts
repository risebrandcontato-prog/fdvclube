import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function encodeKeyToBase64(key: ArrayBuffer | null) {
  if (!key) return "";
  const bytes = new Uint8Array(key);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function usePushNotifications(playerId: string | null) {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );
  const [subscribed, setSubscribed] = useState(false);

  const registerPush = useCallback(async (pid: string) => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

    const registration = await navigator.serviceWorker.ready;
    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) throw new Error("VITE_VAPID_PUBLIC_KEY não configurada.");

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }

    const raw = subscription.toJSON();
    const p256dh = raw.keys?.p256dh || encodeKeyToBase64(subscription.getKey("p256dh"));
    const auth = raw.keys?.auth || encodeKeyToBase64(subscription.getKey("auth"));

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        player_id: pid,
        endpoint: subscription.endpoint,
        p256dh,
        auth,
        user_agent: navigator.userAgent,
      },
      { onConflict: "player_id,endpoint" },
    );

    if (error) throw new Error(error.message);
    setSubscribed(true);
    return true;
  }, []);

  const requestPermission = useCallback(async () => {
    if (!playerId) return;
    if (typeof Notification === "undefined") return;

    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      await registerPush(playerId);
    }
  }, [playerId, registerPush]);

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (!playerId || permission !== "granted") return;
    void registerPush(playerId).catch(() => {
      setSubscribed(false);
    });
  }, [permission, playerId, registerPush]);

  return { permission, subscribed, requestPermission };
}
