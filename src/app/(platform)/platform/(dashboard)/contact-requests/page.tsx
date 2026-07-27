import { getContactRequests } from "@/lib/data/platformContactRequests";

import { resolveContactRequest } from "./actions";
import { ContactRequestsManager } from "./contact-requests-manager";

export default async function PlatformContactRequestsPage() {
  const requests = await getContactRequests();

  return <ContactRequestsManager requests={requests} resolveContactRequest={resolveContactRequest} />;
}
