import { getTranslations } from "next-intl/server";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getAdminRatings } from "@/lib/data/adminRatings";

export default async function AdminRatingsPage() {
  const actor = await requireAdminActor();
  const t = await getTranslations("admin.ratings");
  const { ratings, averageStars, count } = await getAdminRatings(actor.tenantId);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t("title")} />

      <p className="text-sm text-muted-foreground">
        {count > 0 ? t("average", { stars: averageStars!.toFixed(1), count }) : t("empty")}
      </p>

      <div className="flex flex-col gap-3">
        {ratings.map((rating) => (
          <div key={rating.id} className="flex flex-col gap-1 rounded-md border border-border p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{"★".repeat(rating.stars)}</span>
              <span className="text-xs text-muted-foreground">{new Date(rating.createdAt).toLocaleString()}</span>
            </div>
            {rating.comment && <p className="text-muted-foreground">{rating.comment}</p>}
            {rating.ratedStaffBadge && rating.staffStars && (
              <p className="text-xs text-muted-foreground">
                {t("staffRating", { badge: rating.ratedStaffBadge, stars: rating.staffStars })}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
