
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
import PrivateRoute from './components/PrivateRoute';
import { AuthProvider } from './context/AuthContext';
import ToastHost from './components/ToastHost';

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
            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/profile-setup" element={<PrivateRoute><ProfileForm /></PrivateRoute>} />
            <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
            <Route path="/interview-form" element={<PrivateRoute><InterviewForm /></PrivateRoute>} />
            <Route path="/resume-interview" element={<PrivateRoute><ResumeInterview /></PrivateRoute>} />
            <Route path="/interview-session/:id" element={<PrivateRoute><InterviewSession /></PrivateRoute>} />
            <Route path="/result/:id" element={<PrivateRoute><Result /></PrivateRoute>} />
            <Route path="/payment" element={<PrivateRoute><Payment /></PrivateRoute>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ClerkProvider>
  );
};

export default App;
