import { Client } from "@notionhq/client";
import { optional, required } from "../env";
import { FIELD } from "./schema";

// The SDK’s response types are very deep unions; the mapper validates shapes itself.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NotionAny = any;

let client: Client | undefined;
export const notion = (): Client =>
  (client ??= new Client({
    auth: required("NOTION_TOKEN"),
    // Development only: point the app at scripts/mock-notion.mjs to try it without touching the real database.
    ...(process.env.NODE_ENV !== "production" && optional("NOTION_BASE_URL") ? { baseUrl: optional("NOTION_BASE_URL") } : {}),
  }));

export interface Schema {
  dataSourceId: string;
  titleProp: string;
  /** Existing property name -> type. */
  props: Record<string, string>;
  /** Option names of every select / multi-select / status column, in Notion’s order. */
  options: Record<string, string[]>;
}

let schema: Promise<Schema> | undefined;

/**
 * Notion queries "data sources" rather than databases: resolve the database id to its first data source and read
 * its columns. Cached for the process lifetime; reset on failure so a fixed .env.local is picked up.
 */
export function getSchema(): Promise<Schema> {
  schema ??= resolve().catch((error) => {
    schema = undefined;
    throw error;
  });
  return schema;
}

/** Forget the cached columns and options (a new author or rank option was just written). */
export const refreshSchema = () => {
  schema = undefined;
};

async function resolve(): Promise<Schema> {
  const n = notion();
  const databaseId = required("READING_DATABASE_ID");
  const db: NotionAny = await n.databases.retrieve({ database_id: databaseId });
  const dataSourceId: string = db.data_sources?.[0]?.id ?? databaseId;
  const ds: NotionAny = await n.dataSources.retrieve({ data_source_id: dataSourceId });

  const props: Record<string, string> = {};
  const options: Record<string, string[]> = {};
  let titleProp = "";
  for (const [name, def] of Object.entries<NotionAny>(ds.properties ?? {})) {
    props[name] = def.type;
    const list = def.multi_select?.options ?? def.select?.options ?? def.status?.options;
    if (list) options[name] = list.map((o: NotionAny) => o.name);
    if (def.type === "title") titleProp = name;
  }
  if (!titleProp) throw new Error("The Notion database has no title column");
  const missing = Object.values(FIELD).filter((name) => props[name] === undefined);
  if (missing.length > 0) throw new Error(`The Notion database is missing these columns: ${missing.join(", ")}`);
  return { dataSourceId, titleProp, props, options };
}
