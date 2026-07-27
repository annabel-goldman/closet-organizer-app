# Deployment

Curated Closet is deployed as a single Heroku app. The Rails backend serves the JSON API and the built Vite frontend from `back-end/public`.

## Production App

- Heroku app: `closet-organizer`
- Public URL: `https://closet-organizer-165f918adeda.herokuapp.com/`
- Heroku Git remote: `https://git.heroku.com/closet-organizer.git`
- Runtime stack: Heroku-24
- Buildpacks, in order:
  1. `heroku/nodejs`
  2. `heroku/ruby`
- Database: Heroku Postgres `essential-0`, attached as `DATABASE_URL`
- Dyno: currently `Basic`; Heroku requires an Eco subscription before this app can be moved to `Eco`

## Build And Runtime Flow

Heroku builds from the repository root.

- The root `package.json` pins Node `22.x`.
- The root `heroku-postbuild` script runs `cd front-end && npm install && npm run build && cp -r dist/. ../back-end/public`.
- The root `Procfile` runs `cd back-end && bundle exec rails db:prepare` during release.
- The `web` process runs `cd back-end && bundle exec rails server -p $PORT -e $RAILS_ENV`.

Because `db:prepare` runs during the release phase, new migrations are applied automatically during deploy. On a brand-new empty database, Rails can also run seeds.

## CI/CD

GitHub Actions handles deploy automation. The Heroku dashboard GitHub integration is not required.

- `.github/workflows/ci.yml` runs on pull requests and pushes to `main`.
- CI includes backend lockfile checks, Brakeman, Bundler Audit, RuboCop, ERB linting, Rails tests, frontend tests, and the frontend production build.
- `.github/workflows/deploy.yml` runs after `CI` succeeds on `main`.
- The deploy workflow pushes the exact `main` commit to the Heroku Git remote.

Required GitHub repository secret:

```text
HEROKU_API_KEY
```

This secret should contain a Heroku API token for the account that owns the `closet-organizer` app. Do not commit the token.

## Required Heroku Config Vars

Set secret values in Heroku config vars only. Do not commit them.

```text
ACTIVE_STORAGE_SERVICE=amazon
AWS_ACCESS_KEY_ID=<redacted>
AWS_SECRET_ACCESS_KEY=<redacted>
AWS_REGION=<aws-region>
S3_BUCKET_NAME=<bucket-name>
DATABASE_URL=<managed-by-heroku-postgres>
GOOGLE_CLIENT_ID=<redacted>
GOOGLE_CLIENT_SECRET=<redacted>
OPENROUTER_API_KEY=<redacted>
OPENROUTER_APP_NAME=Closet Organizer
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=<model-id>
OPENROUTER_SITE_URL=https://closet-organizer-165f918adeda.herokuapp.com
RACK_ENV=production
RAILS_ENV=production
```

`DATABASE_URL` is created automatically by the Heroku Postgres add-on.

## Google OAuth

The Google OAuth client must include the production Heroku URL.

Authorized JavaScript origin:

```text
https://closet-organizer-165f918adeda.herokuapp.com
```

Authorized redirect URI:

```text
https://closet-organizer-165f918adeda.herokuapp.com/auth/google_oauth2/callback
```

Approved user emails are enforced in `back-end/app/models/user.rb`.

## Storage

Production uploads and generated images use Active Storage with the `amazon` service in `back-end/config/storage.yml`.

Heroku's filesystem is ephemeral, so user uploads and AI-cleaned images must use S3-compatible object storage in production. Local `.env` files can hold the same variable names for development, but production values live in Heroku config vars.

## Useful Commands

Check the active Heroku account:

```bash
heroku auth:whoami
```

Show Heroku app info:

```bash
heroku apps:info -a closet-organizer
```

List config variable names without values:

```bash
heroku config -s -a closet-organizer | cut -d= -f1 | sort
```

Show dyno status:

```bash
heroku ps -a closet-organizer
```

Tail logs:

```bash
heroku logs --tail -a closet-organizer
```

Manually deploy the current commit:

```bash
git push heroku HEAD:main
```

Run a one-off Rails command:

```bash
heroku run 'cd back-end && bundle exec rails runner "puts User.count"' -a closet-organizer
```

Check production health:

```bash
curl -i https://closet-organizer-165f918adeda.herokuapp.com/up
```

## Notes

- The first production deploy created release `v6` from commit `88374d2`.
- The fresh production database was seeded during the first release because `db:prepare` ran against an empty database.
- If the account subscribes to Eco later, the web dyno can be moved with `heroku ps:type web=eco -a closet-organizer`.
