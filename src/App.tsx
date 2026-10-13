import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import { TrackerApp } from '@/components/hud/TrackerApp';

// Pages serves the site under /<repo>/, so the router has to ignore that prefix. BASE_URL is "/" or "/<repo>/".
const ROUTER_BASENAME = import.meta.env.BASE_URL.replace(/\/+$/, '') || undefined;

function App() {
  return (
    <BrowserRouter basename={ROUTER_BASENAME}>
      <Routes>
        {/* TrackerApp renders its own <main>, so no wrapper element here. */}
        <Route path="/" element={<TrackerApp />} />
        {/*
          The static hosts fall back to index.html for any path (nginx) or serve it as 404.html
          (Pages), and /index.html is a plausible address in its own right. None of those match "/",
          so without this route the page would be blank.
        */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
