// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A ProfileTable in memory for the tests: the items of one player, keyed by sk.
import type { ProfileTable } from "../cloud/table-cloud-store";

export const IDENTITY_ID = "us-east-2:11111111-2222-4333-8444-555555555555";

export class MemoryTable implements ProfileTable {
  readonly pk: string;
  readonly items = new Map<string, Record<string, unknown>>();
  /** sk of every write and delete, in order. */
  readonly log: string[] = [];

  constructor(pk = IDENTITY_ID) {
    this.pk = pk;
  }

  get(sk: string): Promise<unknown> {
    return Promise.resolve(this.items.get(sk));
  }

  put(item: Readonly<Record<string, unknown>>): Promise<void> {
    const sk = String(item.sk);
    this.items.set(sk, { ...item, pk: this.pk });
    this.log.push(`put ${sk}`);
    return Promise.resolve();
  }

  delete(sk: string): Promise<void> {
    this.items.delete(sk);
    this.log.push(`delete ${sk}`);
    return Promise.resolve();
  }

  query(skPrefix: string): Promise<unknown[]> {
    return Promise.resolve(
      [...this.items.entries()].filter(([sk]) => sk.startsWith(skPrefix)).map(([, item]) => item),
    );
  }
}
