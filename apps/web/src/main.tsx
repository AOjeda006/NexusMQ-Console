import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { router } from '@/app/router';
import { ThemeProvider } from '@/app/theme/theme-provider';

import './styles/global.css';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('No se encontró el elemento raíz #root en index.html.');
}

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  </StrictMode>,
);
