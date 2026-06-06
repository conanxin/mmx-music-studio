import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SettingsProvider } from './lib/settingsStore';
import Layout from './components/Layout';
import Home from './features/home/Home';
import Studio from './features/studio/Studio';
import Library from './features/library/Library';
import Settings from './features/settings/Settings';
import Docs from './features/docs/Docs';

export default function App() {
  return (
    <SettingsProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="studio" element={<Studio />} />
            <Route path="library" element={<Library />} />
            <Route path="settings" element={<Settings />} />
            <Route path="docs" element={<Docs />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SettingsProvider>
  );
}