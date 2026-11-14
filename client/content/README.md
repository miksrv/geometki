# Page texts

Long texts of static pages live here as Markdown, one file per page and language:
`<page>.<locale>.md` (`game-help.ru.md`, `game-help.en.md`). Short interface labels stay in
`public/locales/<locale>/common.json`.

- A page reads its file on the server with `loadContent()` (`utils/content.server.ts`) and gets
  ready HTML: the browser loads neither the text of the other language nor a Markdown parser.
- Write for a reader: `##` for the sections of a page (the page's `h1` is its title, not in the
  file), short paragraphs, lists for steps. Raw HTML is escaped.
- A page may keep its title and SEO description in the file too, as front matter
  (`---`, `title: …`, `description: …`, `---`; one line each) read by `loadContentPage()`.
- Photos: put them in `public/images/<page>/` as webp (about 2048px wide, no metadata:
  `cwebp -q 78 -resize 2048 0 -metadata none`), the Next.js optimizer makes the smaller sizes.
  Images in a paragraph of their own are a row of photos (up to four in a row, more go on the
  next rows, two on phones), one image per line, the alt text is the caption in the lightbox:

  ```md
  ![Велопоход по степи](/images/about/cycling-steppe.webp)
  ![Велосипед на степной дороге](/images/about/bike-steppe-road.webp)
  ```
- Every page has both languages; the Russian file is the fallback when the other is missing.
- The files are added to the standalone build by `outputFileTracingIncludes` in `next.config.js`.
