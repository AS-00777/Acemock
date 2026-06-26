
import type { FC } from 'react';
import { ClerkProvider } from '@clerk/clerk-react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import InterviewForm from './pages/InterviewForm';
import ResumeInterview from './pages/ResumeInterview';
import InterviewSession from './pages/InterviewSession';
import ProfileForm from './pages/ProfileForm';
import Settings from './pages/Settings';
import Result from './pages/Result';
import Pricing from './pages/Pricing';
import Payment from './pages/Payment';
import Help from './pages/Help';
import { Login, Signup, ForgotPassword, ResetPassword } from './pages/Auth';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import ToastHost from './components/ToastHost';
import AptitudeSetup from './pages/AptitudeSetup';
import AptitudeQuiz from './pages/AptitudeQuiz';
import AptitudeResult from './pages/AptitudeResult';
import ComingSoon from './pages/ComingSoon';

const clerkPublishableKey = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;

if (!clerkPublishableKey) {
  console.warn("Missing REACT_APP_CLERK_PUBLISHABLE_KEY. Clerk auth will not initialize.");
}

const App: FC = () => {
  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey || ""}
      afterSignInUrl="/dashboard"
      afterSignUpUrl="/dashboard"
    >
      <AuthProvider>
        <ToastHost />
        <Router>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login/*" element={<Login />} />
            <Route path="/signup/*" element={<Signup />} />
            <Route path="/forgot-password/*" element={<ForgotPassword />} />
            <Route path="/reset-password/*" element={<ResetPassword />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/help" element={<Help />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/profile-setup" element={<ProtectedRoute><ProfileForm /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/interview-form" element={<ProtectedRoute><InterviewForm /></ProtectedRoute>} />
            <Route path="/resume-interview" element={<ProtectedRoute><ResumeInterview /></ProtectedRoute>} />
            <Route path="/interview-session/:id" element={<ProtectedRoute><InterviewSession /></ProtectedRoute>} />
            <Route path="/interview/:id" element={<ProtectedRoute><InterviewSession /></ProtectedRoute>} />
            <Route path="/result/:id" element={<ProtectedRoute><Result /></ProtectedRoute>} />
            <Route path="/results/:id" element={<ProtectedRoute><Result /></ProtectedRoute>} />
            <Route path="/payment" element={<ProtectedRoute><Payment /></ProtectedRoute>} />
            <Route path="/preparation" element={<Navigate to="/aptitude" />} />
            <Route path="/preparation/aptitude/setup" element={<Navigate to="/aptitude" />} />
            <Route path="/preparation/aptitude/test/:testId" element={<ProtectedRoute><AptitudeQuiz /></ProtectedRoute>} />
            <Route path="/preparation/aptitude/result/:testId" element={<ProtectedRoute><AptitudeResult /></ProtectedRoute>} />
            <Route path="/aptitude" element={<Navigate to="/aptitude/topic/quantitative" />} />
            <Route path="/aptitude/company/:company" element={<ProtectedRoute><AptitudeSetup /></ProtectedRoute>} />
            <Route path="/aptitude/topic/:topic" element={<ProtectedRoute><AptitudeSetup /></ProtectedRoute>} />
            <Route path="/aptitude/technical" element={<ProtectedRoute><AptitudeSetup /></ProtectedRoute>} />
            <Route path="/aptitude/technical/:technicalTopic" element={<ProtectedRoute><AptitudeSetup /></ProtectedRoute>} />
            <Route path="/aptitude/mock" element={<ProtectedRoute><AptitudeSetup /></ProtectedRoute>} />
            <Route path="/aptitude/patterns" element={<ProtectedRoute><ComingSoon /></ProtectedRoute>} />
            <Route path="/aptitude/analytics" element={<ProtectedRoute><ComingSoon /></ProtectedRoute>} />
            <Route path="/mock-test/:mockType" element={<ProtectedRoute><AptitudeSetup /></ProtectedRoute>} />
            <Route path="/placement-patterns/:company" element={<ProtectedRoute><ComingSoon /></ProtectedRoute>} />
            <Route path="/resources/:resource" element={<ProtectedRoute><ComingSoon /></ProtectedRoute>} />
            <Route path="/resume-builder" element={<ProtectedRoute><ComingSoon /></ProtectedRoute>} />
            <Route path="/ats-checker" element={<ProtectedRoute><ComingSoon /></ProtectedRoute>} />
            <Route path="/resume-analyzer" element={<ProtectedRoute><ResumeInterview /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ClerkProvider>
  );
};

export default App;
