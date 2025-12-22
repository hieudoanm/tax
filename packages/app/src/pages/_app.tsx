import '@tax/styles/globals.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { FC } from 'react';

const App: FC<AppProps> = ({ Component, pageProps }: AppProps) => {
  return (
    <>
      <Head>
        <title>Tax</title>
        <link rel="icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.json" />
      </Head>
      <Component {...pageProps} />
    </>
  );
};

export default App;
