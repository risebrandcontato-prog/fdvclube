import { Bell, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";

type PushNotificationToggleProps = {
  playerId: string;
};

export function PushNotificationToggle({ playerId }: PushNotificationToggleProps) {
  const { permission, subscribed, requestPermission } = usePushNotifications(playerId);
  const isActive = permission === "granted" && subscribed;

  if (isActive) {
    return (
      <Button type="button" variant="outline" disabled className="gap-2">
        <BellRing className="h-4 w-4 text-green-500" />
        Notificações ativas
      </Button>
    );
  }

  return (
    <Button type="button" variant="outline" onClick={() => void requestPermission()} className="gap-2">
      <Bell className="h-4 w-4" />
      Ativar notificações
    </Button>
  );
}
