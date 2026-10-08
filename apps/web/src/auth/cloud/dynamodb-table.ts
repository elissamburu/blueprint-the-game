// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// ProfileTable on DynamoDB with the document client. pk is always the identity ID of the
// credentials: the policy of the player role only allows items with that partition key
// (dynamodb:LeadingKeys, infra/modules/auth), so another pk would be denied anyway. Reads are
// consistent: right after a write (signing in on an empty profile) the profile is read back.
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  type DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import type { ProfileTable } from "./table-cloud-store";

export class DynamoDbProfileTable implements ProfileTable {
  readonly pk: string;
  readonly #client: DynamoDBDocumentClient;
  readonly #table: string;

  constructor(client: DynamoDBDocumentClient, table: string, pk: string) {
    this.#client = client;
    this.#table = table;
    this.pk = pk;
  }

  async get(sk: string): Promise<unknown> {
    const { Item } = await this.#client.send(
      new GetCommand({ TableName: this.#table, Key: { pk: this.pk, sk }, ConsistentRead: true }),
    );
    return Item;
  }

  async put(item: Readonly<Record<string, unknown>>): Promise<void> {
    await this.#client.send(
      new PutCommand({ TableName: this.#table, Item: { ...item, pk: this.pk } }),
    );
  }

  async delete(sk: string): Promise<void> {
    await this.#client.send(
      new DeleteCommand({ TableName: this.#table, Key: { pk: this.pk, sk } }),
    );
  }

  async query(skPrefix: string): Promise<unknown[]> {
    const items: unknown[] = [];
    let start: Record<string, unknown> | undefined;
    do {
      const page = await this.#client.send(
        new QueryCommand({
          TableName: this.#table,
          KeyConditionExpression:
            skPrefix === "" ? "pk = :pk" : "pk = :pk AND begins_with(sk, :prefix)",
          ExpressionAttributeValues:
            skPrefix === "" ? { ":pk": this.pk } : { ":pk": this.pk, ":prefix": skPrefix },
          ConsistentRead: true,
          ExclusiveStartKey: start,
        }),
      );
      items.push(...(page.Items ?? []));
      start = page.LastEvaluatedKey;
    } while (start !== undefined);
    return items;
  }
}
