import { lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { DataProvider } from './lib/data';
import { DataAssumptions, NotFound } from './pages/Other';

const Home = lazy(() => import('./pages/Home'));
const MapPage = lazy(() => import('./pages/MapPage'));
const Planner = lazy(() => import('./pages/Planner'));
const Costs = lazy(() => import('./pages/Costs'));
const Rollout = lazy(() => import('./pages/Rollout'));
const Impact = lazy(() => import('./pages/Impact'));
const Subsidies = lazy(() => import('./pages/Subsidies'));
const Help = lazy(() => import('./pages/Help'));
const Complaints = lazy(() => import('./pages/Complaints'));
const Heatmap = lazy(() => import('./pages/Heatmap'));

export default function App() {
  return (
    <DataProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/planner" element={<Planner />} />
            <Route path="/costs" element={<Costs />} />
            <Route path="/rollout" element={<Rollout />} />
            <Route path="/impact" element={<Impact />} />
            <Route path="/subsidies" element={<Subsidies />} />
            <Route path="/help" element={<Help />} />
            <Route path="/complaints" element={<Complaints />} />
            <Route path="/heatmap" element={<Heatmap />} />
            <Route path="/data" element={<DataAssumptions />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </DataProvider>
  );
}
