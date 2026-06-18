import { useEffect } from 'react';

const APP_NAME = 'AtendeAI';

/**
 * Updates document.title dynamically so the browser tab reflects the current page.
 * Falls back to the app name alone when no page title is provided.
 *
 * Usage:
 *   usePageTitle('Contatos');        // tab: "Contatos | AtendeAI"
 *   usePageTitle();                  // tab: "AtendeAI"
 */
export function usePageTitle(pageTitle?: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = pageTitle ? `${pageTitle} | ${APP_NAME}` : APP_NAME;
    return () => {
      document.title = previous;
    };
  }, [pageTitle]);
}
