import { Bell, BookOpen, Shield, CreditCard, Loader2 } from "lucide-react";
import { useGetNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@/hooks/useApi";
import { timeAgo } from "@/lib/format";

const iconForType = (type: string) => {
  if (type === "security_alert") return Shield;
  if (type === "subscription_expiry") return CreditCard;
  if (type === "new_content") return BookOpen;
  return Bell;
};

const NotificationsScreen = () => {
  const { data, isLoading } = useGetNotifications();
  const { mutate: markRead } = useMarkNotificationRead();
  const { mutate: markAllRead } = useMarkAllNotificationsRead();

  const notifications = data?.data || [];
  const unreadCount = data?.unreadCount || 0;

  return (
    <div className="pb-4">
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-lg font-bold text-foreground">Notifications</h1>
          {unreadCount > 0 && (
            <span className="px-2.5 py-0.5 bg-primary text-primary-foreground text-[10px] font-semibold rounded-full">
              {unreadCount} new
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={() => markAllRead()} className="text-xs text-primary font-semibold mb-2">
            Mark all as read
          </button>
        )}
        <p className="text-xs text-muted-foreground mb-4">Stay updated with your learning</p>
      </div>

      <div className="px-5 space-y-2.5">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <p className="text-center text-sm text-foreground/50 py-10">No notifications yet</p>
        ) : (
          notifications.map((notif: any) => {
            const Icon = iconForType(notif.type);
            return (
              <button
                key={notif._id}
                onClick={() => !notif.isRead && markRead(notif._id)}
                className={`w-full flex items-start gap-3 p-3.5 rounded-xl border transition-all text-left ${
                  !notif.isRead ? "bg-primary/5 border-primary/20" : "bg-card border-border"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    notif.type === "security_alert"
                      ? "bg-destructive/10"
                      : notif.type === "subscription_expiry"
                        ? "bg-accent/20"
                        : "bg-primary/10"
                  }`}
                >
                  <Icon
                    size={16}
                    className={
                      notif.type === "security_alert"
                        ? "text-destructive"
                        : notif.type === "subscription_expiry"
                          ? "text-accent"
                          : "text-primary"
                    }
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h4 className="text-sm font-bold text-foreground">{notif.title}</h4>
                    {!notif.isRead && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                  </div>
                  <p className="text-xs text-foreground/60 leading-relaxed">{notif.body}</p>
                  <p className="text-[10px] text-foreground/40 mt-1">{timeAgo(notif.createdAt)}</p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default NotificationsScreen;
