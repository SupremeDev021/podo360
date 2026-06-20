import { AlertTriangle, Info, Megaphone, X } from "lucide-react";
import { useEffect, useState } from "react";
import { listActivePlatformAnnouncements } from "../services/platformAnnouncementsService";
import type { PlatformAnnouncement, PlatformAnnouncementSeverity } from "../services/platformAnnouncementsService";

const severityIcon: Record<PlatformAnnouncementSeverity, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  maintenance: Megaphone,
  critical: AlertTriangle
};

export function SystemNoticeBanner() {
  const [announcements, setAnnouncements] = useState<PlatformAnnouncement[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    void listActivePlatformAnnouncements().then((items) => {
      if (mounted) setAnnouncements(items);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const visible = announcements.find((announcement) => !dismissedIds.includes(announcement.id));
  if (!visible) return null;

  const Icon = severityIcon[visible.severity] ?? Info;

  return (
    <aside className={`system-notice system-notice--${visible.severity}`} role="status" aria-live="polite">
      <Icon size={18} />
      <div>
        {visible.title && <strong>{visible.title}</strong>}
        <span>{visible.message}</span>
      </div>
      {visible.dismissible && (
        <button aria-label="Fechar aviso" onClick={() => setDismissedIds((current) => [...current, visible.id])} type="button">
          <X size={16} />
        </button>
      )}
    </aside>
  );
}
