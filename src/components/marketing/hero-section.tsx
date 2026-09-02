import Link from "next/link";
import { delayStyle } from "@/lib/motion";

export function HeroSection({ viewerSignedIn }: { viewerSignedIn: boolean }) {
  return (
    <div className="lg:col-span-7">
      <p className="label-mono rise-in text-accent-strong" style={delayStyle(0)}>
        Receipts in — balances out.
      </p>
      <h1
        className="display rise-in mt-5 text-6xl sm:text-7xl lg:text-8xl"
        style={delayStyle(90)}
      >
        Split the bill.
        <br />
        Keep the receipts<span className="text-accent">.</span>
      </h1>
      <p
        className="rise-in mt-6 max-w-md text-lg leading-relaxed text-stone-600"
        style={delayStyle(180)}
      >
        Add an itemized receipt — or snap a photo of one — tag who got what, and Tab works out
        exactly who owes whom. No passwords, no spreadsheets, no &ldquo;wait, what do I owe you
        again?&rdquo;
      </p>

      {/* create-event CTA */}
      <CtaCard viewerSignedIn={viewerSignedIn} />
    </div>
  );
}

function CtaCard({ viewerSignedIn }: { viewerSignedIn: boolean }) {
  return (
    <div className="paper-card rise-in mt-10 max-w-lg p-6" id="start" style={delayStyle(280)}>
      {viewerSignedIn ? (
        <Link
          href="/create"
          className="label-mono block text-center text-accent-strong transition hover:underline"
        >
          Start a new tab →
        </Link>
      ) : (
        <div className="py-2 text-center">
          <p className="font-medium">Sign in to start a tab</p>
          <p className="mt-2 font-mono text-xs leading-relaxed text-stone-500">
            Magic link, no password. You&apos;ll get a shareable link anyone can view.
          </p>
          <Link
            href={`/signin?next=${encodeURIComponent("/create")}`}
            className="btn-ink mt-4 inline-flex w-full justify-center"
          >
            Sign in &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}
