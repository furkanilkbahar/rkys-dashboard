import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getAdminIngredients } from "@/lib/data/ingredients";
import { getAdminSuppliers } from "@/lib/data/suppliers";
import { assertModuleEnabled } from "@/lib/modules/isEnabled";

import { createIngredient, recordCount, recordPurchase, recordWaste, updateIngredient } from "./actions";
import { IngredientsManager } from "./ingredients-manager";

export default async function AdminIngredientsPage() {
  const actor = await requireAdminActor();
  await assertModuleEnabled(actor.tenantId, "inventory");

  const [ingredients, suppliers] = await Promise.all([getAdminIngredients(actor.tenantId), getAdminSuppliers(actor.tenantId)]);

  return (
    <IngredientsManager
      ingredients={ingredients}
      suppliers={suppliers}
      createIngredient={createIngredient}
      updateIngredient={updateIngredient}
      recordPurchase={recordPurchase}
      recordWaste={recordWaste}
      recordCount={recordCount}
    />
  );
}
