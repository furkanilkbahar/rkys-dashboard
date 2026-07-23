import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getAdminIngredients } from "@/lib/data/ingredients";
import { assertModuleEnabled } from "@/lib/modules/isEnabled";

import { createIngredient, updateIngredient } from "./actions";
import { IngredientsManager } from "./ingredients-manager";

export default async function AdminIngredientsPage() {
  const actor = await requireAdminActor();
  await assertModuleEnabled(actor.tenantId, "inventory");

  const ingredients = await getAdminIngredients(actor.tenantId);

  return <IngredientsManager ingredients={ingredients} createIngredient={createIngredient} updateIngredient={updateIngredient} />;
}
