import "server-only";

import { randomUUID } from "crypto";

import type { FiscalDeviceProvider, FiscalReceiptInput, FiscalReceiptResult, VoidFiscalReceiptInput } from "./provider";

export const mockFiscalProvider: FiscalDeviceProvider = {
  name: "mock",

  async printFiscalReceipt(input: FiscalReceiptInput): Promise<FiscalReceiptResult> {
    void input;
    return { fiscalReceiptRef: `mock-fiscal-${randomUUID()}` };
  },

  async voidFiscalReceipt(input: VoidFiscalReceiptInput): Promise<void> {
    void input;
  },
};
