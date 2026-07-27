import { getPlans } from "@/lib/data/plans";

import { registerTenant } from "./actions";
import { RegisterForm } from "./register-form";

export default async function RegisterPage() {
  const plans = await getPlans();

  return <RegisterForm plans={plans} registerTenant={registerTenant} />;
}
