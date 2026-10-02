import '@/styles/theme.css'
import '@/styles/globals.sass'

export default function NotFoundLayout({ children }: { children: React.ReactNode }) {
    return (
        <html>
            <body>{children}</body>
        </html>
    )
}
