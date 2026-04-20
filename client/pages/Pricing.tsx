import React from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';

const Pricing: React.FC = () => {
  const navigate = useNavigate();
  const { token } = useAuth();

  const handleSelectPlan = (plan: string) => {
    if (!token) {
      navigate('/login');
      return;
    }
    if (plan === 'Basic') {
      navigate('/dashboard');
    } else {
      sessionStorage.setItem('selected_plan', plan);
      navigate('/payment');
    }
  };

  const plans = [
    {
      name: 'Basic',
      price: 'Free',
      description: 'Perfect for getting started with AI practice.',
      features: [
        '10 Mock Interviews',
        '2 Resume Interviews',
        'Standard AI Feedback',
        'Basic Performance Tracking'
      ],
      buttonText: token ? 'Current Plan' : 'Get Started',
      highlight: false,
      priceLabel: 'Free with login'
    },
    {
      name: 'Monthly',
      price: '₹2,000',
      description: 'Enhanced features for serious job seekers.',
      features: [
        '30 Mock Interviews / Mo',
        '10 Resume Interviews / Mo',
        'Enhanced AI Feedback',
        'In-depth Performance Analytics',
        'Priority AI Processing'
      ],
      buttonText: 'Upgrade Now',
      highlight: false,
      priceLabel: 'Per month'
    },
    {
      name: 'Pro / Yearly',
      price: '₹12,000',
      description: 'The ultimate preparation package for leaders.',
      features: [
        'Unlimited Mock Interviews',
        'Unlimited Resume Interviews',
        'Advanced Coding Analysis',
        'All Premium Features Included',
        'Valid for 1 Year',
        'Personal Brand Insights'
      ],
      buttonText: 'Go Pro',
      highlight: true,
      priceLabel: 'Save 50% yearly'
    }
  ];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-20 transition-colors duration-200">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-slate-100 mb-4 font-poppins">Choose Your Plan</h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg md:text-xl font-medium max-w-2xl mx-auto">
            Flexible pricing for everyone. Whether you are a student or a senior professional, we have a plan for you.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div 
              key={plan.name}
              className={`relative flex flex-col bg-white dark:bg-slate-800 rounded-[3rem] p-10 border transition-all duration-300 group hover:-translate-y-2 ${
                plan.highlight 
                ? 'border-blue-600 shadow-2xl shadow-blue-500/10 dark:shadow-none' 
                : 'border-slate-100 dark:border-slate-700 shadow-xl shadow-slate-200/50 dark:shadow-none'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                  Most Popular
                </div>
              )}

              <div className="mb-8">
                <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mb-2">{plan.name}</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">{plan.description}</p>
              </div>

              <div className="mb-8">
                <div className="text-5xl font-black text-slate-900 dark:text-slate-100">{plan.price}</div>
                <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                  {plan.priceLabel}
                </div>
              </div>

              <ul className="space-y-4 mb-10 flex-grow">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-3 text-sm font-bold text-slate-600 dark:text-slate-300">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              <button 
                onClick={() => handleSelectPlan(plan.name)}
                className={`w-full py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${
                  plan.highlight 
                  ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20 hover:bg-blue-700' 
                  : 'bg-slate-900 dark:bg-slate-700 text-white hover:bg-black dark:hover:bg-slate-600 shadow-xl'
                }`}
              >
                {plan.buttonText}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-20 bg-blue-50/50 dark:bg-blue-900/10 rounded-[3rem] p-12 text-center border border-blue-100 dark:border-blue-900/20">
          <h4 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4 font-poppins">Enterprise Questions?</h4>
          <p className="text-slate-500 dark:text-slate-400 font-medium max-w-xl mx-auto mb-8">
            Looking for customized plans for your university or company? Let's talk about dedicated AI models and bulk access.
          </p>
          <a href="mailto:support@acemock.ai" className="text-blue-600 dark:text-blue-400 font-black uppercase text-xs tracking-[0.2em] hover:underline">
            Contact Support →
          </a>
        </div>
      </div>
    </Layout>
  );
};

export default Pricing;
