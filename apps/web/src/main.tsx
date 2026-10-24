import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { PaletteSync } from './components/PaletteSync';
import { PwaBoot } from './components/pwa';
import { ToastProvider } from './components/toast';
import { Loader } from './components/ui';
import './index.css';
import { LangProvider } from './lib/i18n';
import { Blogs, BlogDetail, AlbumDetail, BoardPage, Contact, Contribute, Credits, Gallery, RegistrationLookup } from './pages/Content';
import { EventDetail, Events } from './pages/Events';
import { Home } from './pages/Home';
import { JourneyPage } from './pages/Journey';
import { NotFound } from './pages/NotFound';
import { MyRegistrations } from './pages/My';

// Visitors never download the admin screens: they load only when /admin is opened.
const AdminApp = lazy(() => import('./admin/AdminApp').then((m) => ({ default: m.AdminApp })));

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } } });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <LangProvider>
        <ToastProvider>
        <PwaBoot />
        <PaletteSync />
        <BrowserRouter>
          <Routes>
            <Route path="/admin/*" element={<Suspense fallback={<Loader />}><AdminApp /></Suspense>} />
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="events" element={<Events />} />
              <Route path="events/:slug" element={<EventDetail />} />
              <Route path="blog" element={<Blogs />} />
              <Route path="blog/:slug" element={<BlogDetail />} />
              <Route path="gallery" element={<Gallery />} />
              <Route path="gallery/:id" element={<AlbumDetail />} />
              <Route path="journey" element={<JourneyPage />} />
              <Route path="board" element={<BoardPage />} />
              <Route path="contribute" element={<Contribute />} />
              <Route path="contact" element={<Contact />} />
              <Route path="credits" element={<Credits />} />
              <Route path="my" element={<MyRegistrations />} />
              <Route path="registration" element={<RegistrationLookup />} />
              <Route path="registration/:code" element={<RegistrationLookup />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
        </ToastProvider>
      </LangProvider>
    </QueryClientProvider>
  </StrictMode>,
);
