"use client";

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        {/* Next.js'in yerleşik hata sayfası — kendi tasarımımız Faz 1+'ta gelir. */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
