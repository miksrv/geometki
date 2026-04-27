import React from 'react'
import { Button } from 'simple-react-ui-kit'

import { NextPage } from 'next'
import Head from 'next/head'
import Image from 'next/image'
import { generateNextSeo } from 'next-seo/pages'

import logo from '@/public/images/geometki.svg'

const NotFound: NextPage<object> = () => (
    <div className={'page404'}>
        <Head>
            {generateNextSeo({
                nofollow: true,
                noindex: true
            })}
        </Head>
        <div className={'container'}>
            <Image
                src={logo}
                alt={''}
                width={58}
                height={58}
            />
            <h1>{'You have gone off the map'}</h1>
            <Button
                mode={'primary'}
                size={'medium'}
                link={'/'}
                label={'Go back to the main page'}
            />
        </div>
    </div>
)

export default NotFound
