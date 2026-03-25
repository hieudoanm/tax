import '@tax/styles/globals.css';
import { HeadTemplate } from '../templates/HeadTemplate';
import type { AppProps } from 'next/app';
import { FC } from 'react';

const App: FC<AppProps> = ({ Component, pageProps }: AppProps) => {
  return (
    <>
      <HeadTemplate basic={{ title: 'Tax' }} />
      <Component {...pageProps} />
    </>
  );
};

export default App;
