# Chess Talent Estimator

A Next.js 14 app-router quiz with Supabase email/password auth, varied multi-move mate puzzles, an instant qualitative result, and a $10 Gumroad license unlock for the full breakdown.

## Requirements

- Node.js 18.17 or newer
- npm
- A Supabase project
- A Gumroad product configured for per-sale license keys

## Run locally

```sh
npm install
```

Copy `.env.example` to `.env.local`, then fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
GUMROAD_PRODUCT_PERMALINK=your-gumroad-product-permalink
```

`GUMROAD_PRODUCT_PERMALINK` is the product's Gumroad permalink, not its full URL. It is only used server-side for checkout links and license verification.

In the Supabase SQL Editor, run [`supabase/schema.sql`](supabase/schema.sql). In Supabase Authentication, enable Email auth and configure the site's local and production redirect URLs. For local development, allow `http://localhost:3000/**`.

To enable social sign-in, open Supabase Authentication → Providers and configure Google and GitHub with OAuth client credentials from each provider. Register `https://wnumehvziieypafjmvdh.supabase.co/auth/v1/callback` as the authorized callback URL in each provider's console. In Supabase's redirect allow list, include `http://localhost:3000/**` and your production app URL. The app redirects back to the current origin after OAuth.

In Gumroad, set the product price to $10 and enable per-sale license keys. Then start the app:

```sh
npm run dev
```

Open http://localhost:3000. Create an account or sign in to start the ten-puzzle quiz.

## Checks

```sh
npm run check:puzzles
npm run build
```

`check:puzzles` validates complete solution lines using `chess.js`. The bundled collection contains 72 distinct positions from the [Lichess puzzle database](https://database.lichess.org/), released under CC0: 24 mate-in-one (easy), 24 mate-in-two/three (medium), and 24 mate-in-four-or-more (hard). Each ten-question quiz uses a 4 easy / 4 medium / 2 hard mix and avoids repeating the previous round where possible. Puzzles start after the database's triggering opponent move; recorded opponent replies play automatically after each correct move. The board uses a Lichess-inspired brown theme and interaction cues. The original engine source mentioned in the project request was not included in the prompt; `lib/chess.js` therefore re-exports the established `chess.js` package rather than duplicating or reconstructing move generation.

## App structure

- `app/page.js`: auth gate, interactive board, scoring, result profile, and key redemption
- `app/api/verify-license/route.js`: server-side Gumroad checkout URL and license verification
- `lib/puzzles.js`: public puzzle collection export
- `lib/lichess-puzzles.js`: curated, verified CC0 puzzle data and solution lines
- `lib/chess.js`: chess.js engine export
- `lib/supabase.js`: browser Supabase client
- `supabase/schema.sql`: unlock table and row-level policies

## Important entitlement note

This implements the requested client-side upsert pattern with RLS limiting rows to the signed-in user's ID. A publishable Supabase key and owner-scoped write policy cannot prove that `unlocked=true` came from a valid Gumroad purchase: a technically capable user can write their own unlock row directly. For stronger payment enforcement, move the entitlement upsert into a server route after verification, use a Supabase service-role key stored only on the server, and prevent client-side inserts/updates to `unlocked_users`. The service-role key is intentionally not part of this starter's environment variables because the requested flow has the client perform the upsert.

## Quiz interpretation

The free result is a qualitative summary of a weighted, speed-adjusted score. The rating band is deliberately directional; a ten-puzzle sample is not a formal chess rating.
