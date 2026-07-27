import { submitContactRequest } from "./actions";
import { ContactForm } from "./contact-form";

export default function ContactPage() {
  return <ContactForm submitContactRequest={submitContactRequest} />;
}
