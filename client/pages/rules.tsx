import { ContentPage } from '@/sections/content/content-page'
import { getContentPageProps } from '@/sections/content/content-page/getContentPageProps.server'

/** "Правила": the whole page is a Markdown file (`client/content/rules.<locale>.md`) */
export const getServerSideProps = getContentPageProps('rules')

export default ContentPage
