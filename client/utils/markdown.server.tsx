import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Markdown, { Components } from 'react-markdown'

// A page has its own h2 sections: headings inside a text are one level below them
const components: Components = {
    h1: ({ children }) => <h3>{children}</h3>,
    h2: ({ children }) => <h3>{children}</h3>
}

/**
 * The HTML of a markdown text, made on the server: the page shows it as is and the browser
 * loads no markdown parser for it. The same output as `<Markdown>` in a component: raw HTML in
 * the source is escaped, unsafe links are dropped. Server only: import it from data functions.
 */
export const renderMarkdown = (source?: string | null): string | null =>
    source ? renderToStaticMarkup(<Markdown components={components}>{source}</Markdown>) : null
