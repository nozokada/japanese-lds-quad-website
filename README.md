# japanese-lds-quad-website

Marketing site for the Japanese LDS Quad app, published at
[japanese.ldsquad.app](https://japanese.ldsquad.app). Built with
[Jekyll](https://jekyllrb.com/) and served via GitHub Pages.

## Running locally

### Prerequisites

- [Ruby](https://www.ruby-lang.org/) (a recent 3.x or newer)
- [Bundler](https://bundler.io/) (`gem install bundler`)

### Setup

Install the dependencies (only needed the first time, or after the `Gemfile`
changes):

```bash
bundle install
```

### Start the server

From the repository root:

```bash
bundle exec jekyll serve --livereload
```

Then open:

- Home page: http://127.0.0.1:4000/
- Account page (sign in, create account, purchase, manage): http://127.0.0.1:4000/account/
- The old `/purchase/` URL redirects to `/account/`.

`--livereload` automatically reloads the browser whenever you save a file.

### Stop the server

Press `Ctrl + C` in the terminal where the server is running.

If a server is still holding port 4000 (for example, one started in the
background), stop it with:

```bash
lsof -ti :4000 | xargs kill
```
