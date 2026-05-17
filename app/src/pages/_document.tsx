import { Head, Html, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="zh-Hans">
      <Head />
      <body>
        <Main />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(()=>{const reveal=()=>{document.querySelectorAll('style[data-next-hide-fouc]').forEach((node)=>node.remove());document.body&&document.body.style.removeProperty('display')};document.readyState==='loading'?document.addEventListener('DOMContentLoaded',reveal,{once:true}):reveal()})()",
          }}
        />
        <NextScript />
      </body>
    </Html>
  );
}
