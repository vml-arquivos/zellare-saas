import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './app/AuthProvider';
import { ThemeProvider } from './app/ThemeProvider';
import { router } from './app/router';
import { Toaster } from './components/ui/toaster';
import PwaRuntime from './components/PwaRuntime';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PwaRuntime />
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>
);
