import { useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Layout from './components/layout/Layout';
import Overview from './pages/Overview';
import Revenue from './pages/Revenue';
import CostAnalysis from './pages/CostAnalysis';
import PlanTarget from './pages/PlanTarget';
import Compare from './pages/Compare';
import OperationCost from './pages/OperationCost';
import PLBranch from './pages/PLBranch';
import PricingBenchmark from './pages/PricingBenchmark';
import ProcedureRanking from './pages/ProcedureRanking';
import AIInsights from './pages/AIInsights';
import SGA from './pages/SGA';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import { useDataStore } from './store/useDataStore';
import { useCompareStore } from './store/useCompareStore';
import { useAuthStore } from './store/useAuthStore';
import AuthGuard from './components/AuthGuard';
function AppRoutes() {
  return (
    <>
      <Layout>
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={<Overview />} />
            {/* ExCom */}
            <Route path="/excom/revenue" element={<Revenue />} />
            <Route path="/excom/pl" element={<CostAnalysis />} />
            <Route path="/excom/plan" element={<PlanTarget />} />
            <Route path="/excom/compare" element={<Compare />} />
            <Route path="/excom/sga" element={<SGA />} />
            {/* Operation */}
            <Route path="/operation/cost" element={<OperationCost />} />
            <Route path="/operation/branch" element={<PLBranch />} />
            <Route path="/operation/pricing" element={<PricingBenchmark />} />
            <Route path="/operation/procedure" element={<ProcedureRanking />} />
            {/* AI Insights */}
            <Route path="/ai-insights" element={<AIInsights />} />
            {/* Legacy redirects */}
            <Route path="/revenue" element={<Revenue />} />
            <Route path="/cost" element={<CostAnalysis />} />
            <Route path="/plan" element={<PlanTarget />} />
            <Route path="/compare" element={<Compare />} />
          </Routes>
        </AnimatePresence>
      </Layout>
    </>
  );
}

export default function App() {
  const fetchData = useDataStore(s => s.fetchData);
  const loadFromSupabase = useCompareStore(s => s.loadFromSupabase);
  const initialize = useAuthStore(s => s.initialize);
  const authInitialized = useAuthStore(s => s.initialized);
  const navigate = useNavigate();

  useEffect(() => {
    // Detect invite/recovery tokens in URL hash and redirect to password setup page
    // Preserve the hash so Supabase can still process the access token
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const type = hash.get('type');
    if ((type === 'invite' || type === 'recovery') && window.location.pathname !== '/reset-password') {
      navigate('/reset-password' + window.location.hash, { replace: true });
    }

    const unsub = initialize();
    fetchData();
    return unsub;
  }, [initialize, fetchData, navigate]);

  useEffect(() => {
    if (!authInitialized) return;
    loadFromSupabase();
  }, [authInitialized, loadFromSupabase]);

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      {/* Protected routes */}
      <Route path="/*" element={
        <AuthGuard>
          <AppRoutes />
        </AuthGuard>
      } />
    </Routes>
  );
}
