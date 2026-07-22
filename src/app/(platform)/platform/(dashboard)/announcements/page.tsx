import { listPlatformAnnouncements } from "@/lib/data/platformAnnouncements";

import { AnnouncementsManager } from "./announcements-manager";

export default async function PlatformAnnouncementsPage() {
  const announcements = await listPlatformAnnouncements();

  return <AnnouncementsManager announcements={announcements} />;
}
