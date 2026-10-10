import Document, { Head, Html, Main, NextScript } from 'next/document'

class MyDocument extends Document {
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
