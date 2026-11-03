import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { PaymentRequest } from "@ecomm/bsv-core";

export interface StoredInvoice extends PaymentRequest {
  webhookUrl?: string;
  platform?: string;
  metadata?: Record<string, unknown>;
  txid?: string;
  paidAt?: string;
  simulated: boolean;
  satoshisReceived?: number;
  knownTxid?: string;
  submittedAt?: string;
}

interface Snapshot {
  nextIndex: number;
  invoices: StoredInvoice[];
}

export class InvoiceStore {
  private queue: Promise<void> = Promise.resolve();
  private snapshot: Snapshot = { nextIndex: 0, invoices: [] };
  private readonly file: string;

  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
    this.file = path.join(dataDir, "invoices.json");
    if (existsSync(this.file)) {
      this.snapshot = JSON.parse(readFileSync(this.file, "utf8")) as Snapshot;
    }
  }

  get(id: string): StoredInvoice | undefined {
    return this.snapshot.invoices.find((invoice) => invoice.invoiceId === id);
  }

  findOpenByOrder(orderRef: string, platform?: string): StoredInvoice | undefined {
    return this.snapshot.invoices.find(
      (invoice) =>
        invoice.orderRef === orderRef &&
        invoice.platform === platform &&
        (invoice.status === "pending" || invoice.status === "underpaid"),
    );
  }

  listPending(): StoredInvoice[] {
    return this.snapshot.invoices.filter((invoice) => invoice.status === "pending" || invoice.status === "underpaid");
  }

  allocateIndex(): number {
    const index = this.snapshot.nextIndex;
    this.snapshot.nextIndex += 1;
    this.flush();
    return index;
  }

  save(invoice: StoredInvoice): StoredInvoice {
    const index = this.snapshot.invoices.findIndex((item) => item.invoiceId === invoice.invoiceId);
    if (index >= 0) this.snapshot.invoices[index] = invoice;
    else this.snapshot.invoices.push(invoice);
    this.flush();
    return invoice;
  }

  /** Serialize mutations so two orders cannot take the same derivation index. */
  async mutate<T>(fn: () => T | Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private flush(): void {
    writeFileSync(this.file, JSON.stringify(this.snapshot, null, 2));
  }
}
