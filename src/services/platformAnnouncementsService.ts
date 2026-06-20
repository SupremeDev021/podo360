export type PlatformAnnouncementSeverity = "info" | "warning" | "maintenance" | "critical";

export type PlatformAnnouncement = {
  id: string;
  title?: string;
  message: string;
  severity: PlatformAnnouncementSeverity;
  active: boolean;
  startsAt?: string;
  endsAt?: string;
  dismissible?: boolean;
};

const announcementsEndpoint = import.meta.env.VITE_PLATFORM_ANNOUNCEMENTS_URL as string | undefined;

function isAnnouncementVisible(announcement: PlatformAnnouncement, now = new Date()) {
  if (!announcement.active || !announcement.message.trim()) return false;
  const startsAt = announcement.startsAt ? new Date(announcement.startsAt) : null;
  const endsAt = announcement.endsAt ? new Date(announcement.endsAt) : null;
  if (startsAt && startsAt > now) return false;
  if (endsAt && endsAt < now) return false;
  return true;
}

export async function listActivePlatformAnnouncements() {
  if (!announcementsEndpoint) return [];

  try {
    const response = await fetch(announcementsEndpoint, {
      headers: { accept: "application/json" }
    });
    if (!response.ok) return [];
    const payload = await response.json() as { announcements?: PlatformAnnouncement[] } | PlatformAnnouncement[];
    const announcements = Array.isArray(payload) ? payload : payload.announcements ?? [];
    return announcements.filter((announcement) => isAnnouncementVisible(announcement));
  } catch {
    return [];
  }
}
