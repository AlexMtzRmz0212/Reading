"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/Bits";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // Start in the field with a mouse and keyboard; on a phone that would throw the keyboard up over the page.
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) input.current?.focus();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) }).catch(() => null);
    if (res?.ok) {
      window.location.href = "/desk";
      return;
    }
    setError(!res ? "Couldn’t reach the server. Try again." : res.status === 429 ? "Too many tries. Wait ten minutes, then try again." : "Wrong password. Try again.");
    setBusy(false);
    input.current?.focus();
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-10 flex max-w-xs flex-col gap-4 sm:mt-20">
      <h1 className="page-title">Librarian’s desk</h1>
      <p className="-mt-2 text-soft">Sign in to log pages, add books and edit ranks.</p>
      <label className="block">
        <span className="label">Password</span>
        <input
          ref={input}
          className="input"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "login-error" : undefined}
        />
      </label>
      {error && (
        <p id="login-error" role="alert" className="-mt-2 text-[13px] text-red">
          {error}
        </p>
      )}
      <button className="btn btn-primary" disabled={busy}>
        {busy && <Spinner />}
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
