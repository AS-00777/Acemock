import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { USER_TYPES, EDUCATION_LEVELS, JOB_SEEKER_EXPERIENCE, EXPERIENCE_LEVELS, DOMAINS } from '../constants';

const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
);

const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
);

const ErrorAlert: React.FC<{ message: string }> = ({ message }) => (
  <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 mb-6 animate-pulse">
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
    <span>{message}</span>
  </div>
);

const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const inputClass = "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold transition-all";
const labelClass = "block text-xs font-black text-slate-400 dark:text-slate-500 mb-2 ml-1 uppercase tracking-widest";

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-[85vh] flex flex-col items-center justify-center px-4 py-12 bg-slate-50/50 dark:bg-slate-900 transition-colors">
        <div className="bg-white dark:bg-slate-800 p-10 md:p-12 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-2xl dark:shadow-none w-full max-w-md transition-colors">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2 font-poppins tracking-tight">Welcome Back</h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Practice your way to the top</p>
          </div>

          {error && <ErrorAlert message={error} />}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className={labelClass}>Email Address</label>
              <input 
                type="email" 
                required
                className={inputClass}
                placeholder="name@gmail.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2 ml-1">
                <label className={labelClass}>Password</label>
                <Link to="/forgot-password" className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline">Forgot Password?</Link>
              </div>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  required
                  className={inputClass}
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 dark:shadow-none active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-3"
            >
              {isSubmitting ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-8 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
            Don't have an account? <Link to="/signup" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">Sign up free</Link>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export const Signup: React.FC = () => {
  const [formData, setFormData] = useState({ 
    name: '', 
    email: '', 
    userType: '' as any, 
    password: '', 
    confirmPassword: '',
    educationLevel: '',
    fieldOfStudy: '',
    industry: '',
    yearsExperience: 0,
    targetRole: '',
    experienceLevel: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const navigate = useNavigate();
  const { register, updateProfileExtras } = useAuth();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name) return setError('Full name is required.');
    if (!validateEmail(formData.email)) return setError('Please enter a valid email.');
    if (!formData.userType) return setError('Please select your user type.');
    if (formData.password.length < 6) return setError('Password must be at least 6 characters.');
    if (formData.password !== formData.confirmPassword) return setError('Passwords do not match.');
    if (!termsAccepted) return setError('You must accept the terms and conditions.');

    setIsSubmitting(true);
    try {
      await register(formData.name, formData.email, formData.password);
      updateProfileExtras({
        userType: formData.userType,
        educationLevel: formData.educationLevel,
        fieldOfStudy: formData.fieldOfStudy,
        industry: formData.industry,
        yearsExperience: formData.yearsExperience,
        targetRole: formData.targetRole,
        experienceLevel: formData.experienceLevel,
        skills: formData.targetRole ? [formData.targetRole] : [],
      } as any);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Signup failed');
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-[85vh] flex items-center justify-center px-4 py-20 bg-slate-50/50 dark:bg-slate-900 transition-colors">
        <div className="bg-white dark:bg-slate-800 p-10 md:p-12 rounded-[3rem] border border-slate-200 dark:border-slate-700 shadow-2xl dark:shadow-none w-full max-w-2xl transition-colors">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2 font-poppins tracking-tight">Create Account</h1>
            <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">Join 50,000+ professionals practicing daily</p>
          </div>
          
          {error && <ErrorAlert message={error} />}
          
          <form onSubmit={handleSignup} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={labelClass}>Full Name</label>
                <input 
                  type="text" 
                  required
                  className={inputClass}
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Your Name"
                />
              </div>
              <div>
                <label className={labelClass}>Email Address</label>
                <input 
                  type="email" 
                  required
                  className={inputClass}
                  value={formData.email}
                  onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@example.com"
                />
              </div>
            </div>
            
            <div className="space-y-3">
              <label className={labelClass}>I am a... *</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { id: 'Student', label: 'Student', icon: '🎓' },
                  { id: 'Working Professional', label: 'Professional', icon: '💼' },
                  { id: 'Job Seeker', label: 'Job Seeker', icon: '🔍' }
                ].map(type => (
                  <label key={type.id} className={`relative flex items-center gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer ${formData.userType === type.id ? 'border-blue-600 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md' : 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:border-slate-200 dark:hover:border-slate-600'}`}>
                    <input 
                      type="radio" 
                      name="userType" 
                      className="w-4 h-4 text-blue-600 dark:text-blue-500 focus:ring-blue-500" 
                      checked={formData.userType === type.id}
                      onChange={() => setFormData(prev => ({ ...prev, userType: type.id as any }))}
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{type.icon}</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{type.label}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {formData.userType === 'Student' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                <div>
                  <label className={labelClass}>Education Level</label>
                  <select 
                    className={inputClass}
                    value={formData.educationLevel}
                    onChange={e => setFormData(prev => ({ ...prev, educationLevel: e.target.value }))}
                  >
                    <option value="">Select Level</option>
                    {EDUCATION_LEVELS.map(lvl => <option key={lvl} value={lvl} className="bg-white dark:bg-slate-800">{lvl}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Field of Study</label>
                  <input 
                    type="text" 
                    className={inputClass}
                    placeholder="e.g. Computer Science"
                    value={formData.fieldOfStudy}
                    onChange={e => setFormData(prev => ({ ...prev, fieldOfStudy: e.target.value }))}
                  />
                </div>
              </div>
            )}

            {formData.userType === 'Working Professional' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                <div>
                  <label className={labelClass}>Years of Experience</label>
                  <select 
                    className={inputClass}
                    value={formData.yearsExperience}
                    onChange={e => setFormData(prev => ({ ...prev, yearsExperience: parseInt(e.target.value) }))}
                  >
                    <option value="0" className="bg-white dark:bg-slate-800">Less than 1 Year</option>
                    <option value="1" className="bg-white dark:bg-slate-800">1 Year</option>
                    <option value="2" className="bg-white dark:bg-slate-800">2 Years</option>
                    <option value="3" className="bg-white dark:bg-slate-800">3 Years</option>
                    <option value="5" className="bg-white dark:bg-slate-800">5 Years</option>
                    <option value="10" className="bg-white dark:bg-slate-800">10+ Years</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Industry</label>
                  <input 
                    type="text" 
                    className={inputClass}
                    placeholder="e.g. Fintech, E-commerce"
                    value={formData.industry}
                    onChange={e => setFormData(prev => ({ ...prev, industry: e.target.value }))}
                  />
                </div>
              </div>
            )}

            {formData.userType === 'Job Seeker' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                <div>
                  <label className={labelClass}>Experience Level</label>
                  <select 
                    className={inputClass}
                    value={formData.experienceLevel}
                    onChange={e => setFormData(prev => ({ ...prev, experienceLevel: e.target.value }))}
                  >
                    <option value="" className="bg-white dark:bg-slate-800">Select Level</option>
                    {JOB_SEEKER_EXPERIENCE.map(lvl => <option key={lvl} value={lvl} className="bg-white dark:bg-slate-800">{lvl}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Target Role</label>
                  <input 
                    type="text" 
                    className={inputClass}
                    placeholder="e.g. Product Manager"
                    value={formData.targetRole}
                    onChange={e => setFormData(prev => ({ ...prev, targetRole: e.target.value }))}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={labelClass}>Password</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required
                    className={inputClass}
                    placeholder="Password"
                    value={formData.password}
                    onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400">
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>
              <div>
                <label className={labelClass}>Confirm Password</label>
                <input 
                  type={showPassword ? "text" : "password"} 
                  required
                  className={inputClass}
                  placeholder="Confirm Password"
                  value={formData.confirmPassword}
                  onChange={e => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-start gap-3 ml-1">
              <input 
                type="checkbox" 
                id="terms" 
                required
                className="w-5 h-5 mt-0.5 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                checked={termsAccepted}
                onChange={e => setTermsAccepted(e.target.checked)}
              />
              <label htmlFor="terms" className="text-sm font-medium text-slate-500 dark:text-slate-400 cursor-pointer">
                I agree to the <span className="text-blue-600 dark:text-blue-400 font-bold">Terms</span> and <span className="text-blue-600 dark:text-blue-400 font-bold">Privacy Policy</span>. <span className="text-red-500">*</span>
              </label>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-xl hover:bg-blue-700 shadow-xl shadow-blue-500/20 dark:shadow-none transition-all active:scale-[0.98] mt-4 flex items-center justify-center gap-3"
            >
              {isSubmitting ? 'Creating Profile...' : 'Sign Up Now'}
            </button>
          </form>
          <div className="mt-8 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
            Already have an account? <Link to="/login" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">Log in</Link>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail(email)) {
      setError('Invalid email format.');
      return;
    }
    
    setError('');
    setMessage('');
    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      setMessage('If this email is registered, a reset link has been sent.');
      setCooldown(30);
    }, 1200);
  };

  return (
    <Layout>
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 bg-slate-50/50 dark:bg-slate-900 transition-colors">
        <div className="bg-white dark:bg-slate-800 p-10 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-2xl dark:shadow-none w-full max-w-md transition-colors">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">Reset Password</h2>
            <p className="text-slate-500 dark:text-slate-400">Enter your email to receive a recovery link</p>
          </div>

          {error && <ErrorAlert message={error} />}
          {message && (
            <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 mb-6">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              <span>{message}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className={labelClass}>Email Address</label>
              <input 
                type="email" 
                required
                className={inputClass}
                placeholder="name@gmail.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting || cooldown > 0}
              className="w-full bg-slate-900 dark:bg-slate-700 text-white py-4 rounded-2xl font-bold text-lg hover:bg-black dark:hover:bg-slate-600 transition-all shadow-xl dark:shadow-none disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {isSubmitting ? 'Sending...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Send Reset Link'}
            </button>
          </form>

          <div className="mt-8 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
            Remembered your password? <Link to="/login" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">Back to Login</Link>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    }, 1500);
  };

  if (success) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 p-12 rounded-[3rem] text-center shadow-2xl dark:shadow-none border border-slate-100 dark:border-slate-700 max-w-sm transition-colors">
            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">✓</div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">Password Reset!</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">Your password has been successfully updated. Redirecting to login...</p>
            <div className="w-8 h-8 border-4 border-emerald-500 dark:border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 dark:bg-slate-900 transition-colors">
        <div className="bg-white dark:bg-slate-800 p-10 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-2xl dark:shadow-none w-full max-w-md transition-colors">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">Create New Password</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Make sure it's strong and unique</p>
          </div>

          {error && <ErrorAlert message={error} />}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className={labelClass}>New Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  required
                  className={inputClass}
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            <div>
              <label className={labelClass}>Confirm New Password</label>
              <input 
                type={showPassword ? "text" : "password"} 
                required
                className={inputClass}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-blue-700 shadow-xl shadow-blue-500/20 dark:shadow-none transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {isSubmitting ? 'Updating...' : 'Reset Password'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
};
