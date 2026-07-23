import { notFound } from "next/navigation";

import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getAdminIngredients, getAdminRecipe } from "@/lib/data/ingredients";
import { assertModuleEnabled } from "@/lib/modules/isEnabled";

import { saveRecipe } from "../../actions";
import { RecipeEditor } from "./recipe-editor";

export default async function RecipeEditorPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const actor = await requireAdminActor();
  await assertModuleEnabled(actor.tenantId, "recipes");

  const [recipe, ingredients] = await Promise.all([
    getAdminRecipe(actor.tenantId, productId),
    getAdminIngredients(actor.tenantId),
  ]);
  if (!recipe) {
    notFound();
  }

  return <RecipeEditor recipe={recipe} ingredients={ingredients} saveRecipe={saveRecipe} />;
}
