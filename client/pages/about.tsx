import { ContentPage } from '@/sections/content/content-page'
import { getContentPageProps } from '@/sections/content/content-page/getContentPageProps.server'

/** "О проекте": the whole page is a Markdown file (`client/content/about.<locale>.md`) */
export const getServerSideProps = getContentPageProps('about')

export default ContentPage
