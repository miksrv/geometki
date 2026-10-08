// TEMPORARY until simple-react-ui-kit ships styles.css, see TODO-kit-styles-css.md in the repo root.
//
// Prints the component styles of simple-react-ui-kit to stdout.
//
// The kit ships no stylesheet for its components: the CSS is bundled into `dist/index.esm.js`
// and appended to <head> by JavaScript once the bundle runs. Server-rendered HTML therefore has
// unstyled buttons, containers and menus until hydration, and every page jumps (CLS).
// This script loads the kit with a stub `document` that records those injections, so the same
// CSS can be rendered into the HTML on the server (see `pages/_document.tsx`).
//
// Run in a separate process (next.config.js): the stub must not leak into the Next.js build.

const injected = []
const head = {
    firstChild: null,
    appendChild: (element) => injected.push(element),
    insertBefore: (element) => injected.unshift(element)
}

globalThis.document = {
    head,
    getElementsByTagName: () => [head],
    createElement: () => ({
        css: '',
        appendChild(text) {
            this.css += text
        }
    }),
    createTextNode: (text) => text
}

await import('simple-react-ui-kit')

const css = injected
    .map((element) => element.css)
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};])\s*/g, '$1')
    .trim()

// A kit release with its own stylesheet injects nothing: fail the build instead of shipping an
// unstyled site. Import `simple-react-ui-kit/styles.css` and remove this bridge
if (!css) {
    throw new Error('simple-react-ui-kit no longer injects its CSS, see TODO-kit-styles-css.md in the repo root')
}

process.stdout.write(css)
