import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-md">
      <h1 className="page-title mb-3">No card under that heading</h1>
      <p className="mb-5 text-soft">The card may have been refiled or withdrawn. The drawer has everything that is still in the catalog.</p>
      <Link href="/" className="btn">
        Open the catalog
      </Link>
    </div>
  );
}
