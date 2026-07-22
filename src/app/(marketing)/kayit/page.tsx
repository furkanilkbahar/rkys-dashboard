import { registerTenant } from "./actions";
import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  return <RegisterForm registerTenant={registerTenant} />;
}
