/**
 * Shown instead of a crash when Notion can’t be read: a missing variable, a wrong id, or a database not connected to
 * the integration. The exact error is shown in development only; in production it goes to the server log, because
 * Notion’s messages can name database ids and this page is public.
 */
export function SetupError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);
  const detailed = process.env.NODE_ENV !== "production";
  if (!detailed) console.error("Reading List could not read Notion:", error);
  return (
    <div role="alert" className="max-w-2xl rounded-[3px] border border-edge border-t-[1.5px] border-t-red bg-card p-5">
      <h1 className="mb-2 font-serif text-2xl leading-tight font-bold">The catalog couldn’t be read from Notion</h1>
      {detailed ? (
        <>
          <p className="mb-4 break-words text-red">{message}</p>
          <p className="text-soft">
            Check <code className="text-ink">.env.local</code> against <code className="text-ink">.env.example</code>: <code className="text-ink">NOTION_TOKEN</code> and{" "}
            <code className="text-ink">READING_DATABASE_ID</code> must be set, and the Reading List database must be connected to your integration (in Notion: the database’s ⋯
            menu, Connections).
          </p>
        </>
      ) : (
        <p className="text-soft">The drawer is closed for the moment. Try again in a few minutes.</p>
      )}
    </div>
  );
}
