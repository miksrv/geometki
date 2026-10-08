import Document, { DocumentContext, DocumentInitialProps, Head, Html, Main, NextScript } from 'next/document'

class MyDocument extends Document {
    public static async getInitialProps(ctx: DocumentContext): Promise<DocumentInitialProps> {
        const initialProps = await Document.getInitialProps(ctx)

        // TEMPORARY until simple-react-ui-kit ships styles.css, see TODO-kit-styles-css.md in the repo root.
        // The kit injects its component styles with JavaScript at the end of <head>. The same CSS
        // is rendered here (`styles` go after the Next.js stylesheets, so the cascade order is the
        // same) to have styled HTML before hydration and no layout shift (CLS) when it happens.
        return {
            ...initialProps,
            styles: (
                <>
                    {initialProps.styles}
                    <style
                        id={'kit-components-css'}
                        dangerouslySetInnerHTML={{ __html: process.env.KIT_COMPONENTS_CSS ?? '' }}
                    />
                </>
            )
        }
    }

    public render() {
        return (
            <Html lang={this.props.locale ?? 'ru'}>
                <Head />
                <body>
                    <Main />
                    <NextScript />
                </body>
            </Html>
        )
    }
}

export default MyDocument
