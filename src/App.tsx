import { Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { OrbitalPanorama } from './components/orbital/OrbitalPanorama';

function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route
          path="/"
          element={
            <main className="flex min-h-screen flex-col">
              <Suspense fallback={<div className="p-8 text-slate-500">Loading orbital panorama…</div>}>
                <OrbitalPanorama />
              </Suspense>
            </main>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
