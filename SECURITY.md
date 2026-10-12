# Security policy

ISS-edu is a static, client-side web app. There is no backend, no account system, no database and no
secret of any kind in the repository or in the container image. That keeps the attack surface small, but
reports are still welcome and taken seriously.

## Supported versions

Only the latest commit on `main` and the live demo built from it receive fixes. The project is at version
0.x and does not maintain older release lines.

## Reporting a vulnerability

Please report privately and do not open a public issue for anything that could be exploited.

1. Open the repository's **Security** tab and choose **Report a vulnerability**
   (<https://github.com/CodeWithBehnam/ISS-edu/security/advisories/new>). This uses GitHub's private
   vulnerability reporting, so only the maintainer sees the report. If that option is not available to
   you, open a public issue that asks for a private contact route and leave out the details.
2. Describe what you found, how to reproduce it and what you think the impact is. A proof of concept, the
   browser and version, and whether you used the Docker image or the Pages demo all help.

You can expect an acknowledgement within 7 days. This is a one-person, spare-time project, so fixes are
best effort, but confirmed issues are prioritised over features. Please allow a reasonable time for a fix
before disclosing details publicly. Credit is given in the advisory unless you prefer to stay anonymous.

## Scope

In scope:

- Cross-site scripting or injection through data the app displays (the crew feed, orbital data, the
  country dataset) or through the URL.
- A bypass or weakening of the Content Security Policy, or of the other headers set by the nginx
  configuration in `deploy/nginx/`.
- Weaknesses in the `Dockerfile` or `compose.yaml` (for example running as root, or exposing more than
  port 8080).
- Dependencies with a known vulnerability that is reachable from the built site or the container image.
- Any path by which a visitor's location could leave their browser.

Out of scope:

- The third-party services the app reads from: Celestrak, Where the ISS at?, the crew feed on GitHub
  Pages, Google Fonts and Wikimedia. Report problems with those to their operators.
- Advisories in development-only tooling (the Vite dev server, the test runner, the linter) that cannot
  affect the built site. These are tracked through Dependabot rather than as private reports.
- Denial of service by sending large volumes of traffic, and social engineering of the maintainer.
- Missing response headers on the GitHub Pages demo. Pages cannot set custom headers, so the demo relies
  on the policy in the HTML `<meta>` tag instead. Headers such as `frame-ancestors` and
  `X-Frame-Options` are only available when you run the Docker image or your own server.

## What data the app handles

- **Location.** Pass predictions need an observer position. The app asks the browser for it only when
  you press **Use my location**, and rounds it to two decimal places (about 1 km) before use. The
  coordinates are held in memory for the current page view, are not written to storage, and are never
  included in any network request. Pass times are computed in your browser. Choosing a city from the
  built-in list works the same way and needs no permission. If you decline, nothing is stored.
- **Local storage.** The only item written is `iss:tle:v2`, a cached copy of the ISS orbital elements,
  which are public data. The app sets no cookies, and there is no analytics or tracking. Wikimedia's
  image host sets a `WMF-Uniq` cookie on ordinary image requests, so the crew portraits are loaded with
  `crossorigin="anonymous"`: the browser then sends no credentials and ignores any cookie in the
  response, and none is stored.
- **Third parties.** Like any website that loads remote resources, loading the app discloses your IP
  address and browser details to the hosts it talks to: `celestrak.org` and `api.wheretheiss.at`
  (orbital data), `corquaid.github.io` (crew list), `fonts.googleapis.com` and `fonts.gstatic.com`
  (fonts) and `upload.wikimedia.org` (crew portraits, requested with `no-referrer` and without
  credentials). None of these requests carries your location.

## How the app is hardened

- A strict Content Security Policy: scripts only from the same origin (plus WebAssembly for the model
  decoder), no `eval`, no plugins, and network access limited to the hosts listed above. The built
  `index.html` carries it as a `<meta>` tag; the nginx configuration sends the same policy as a header and
  adds `frame-ancestors 'none'`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy` and `Cross-Origin-Opener-Policy`.
- Data from remote feeds is validated with `zod` before use. Links and image URLs taken from the crew feed
  are accepted only if they are `http` or `https`, and external links use `rel="noopener noreferrer"`.
- The source contains no `innerHTML`, `dangerouslySetInnerHTML` or `eval`.
- The container image serves the built files with `nginx-unprivileged` as a non-root user. `compose.yaml`
  runs it with a read-only root filesystem, all Linux capabilities dropped and `no-new-privileges`.
- `bun.lock` is committed and CI installs with `--frozen-lockfile`. Dependabot proposes updates.

## Known limitations

The build toolchain is on Vite 5 and Vitest 1. Some advisories against them are only fixed in newer major
versions. They concern the local dev server and the test runner (for example the Vitest UI server and the
Vite dev server on Windows), not the static files that are deployed. Moving the toolchain across major
versions has not been done yet. React Router 6 also has two advisories that are only fixed in version 7;
they affect `<Link>`, `useNavigate` and server-side rendering, none of which this single-page app uses.
