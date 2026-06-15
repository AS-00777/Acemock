import React from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';

const Home: React.FC = () => {
  const { token } = useAuth();

  return (
    <Layout>
      <div className="relative overflow-hidden transition-colors duration-200">
        {/* Background Decor */}
        <div className="absolute top-0 right-0 -z-10 w-[600px] h-[600px] bg-blue-50 dark:bg-neutral-900/60 rounded-full blur-3xl opacity-60 translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-0 -z-10 w-[400px] h-[400px] bg-purple-50 dark:bg-neutral-950/70 rounded-full blur-3xl opacity-40 -translate-x-1/2 translate-y-1/2"></div>

        <section className="min-h-[calc(100vh-5rem)] flex items-center">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-sm font-semibold mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 dark:bg-blue-600 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600 dark:bg-blue-500"></span>
              </span>
              New: Gemini 3 Integration for coding interviews
            </div>
            
            <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 dark:text-neutral-100 mb-6 leading-tight tracking-tight">
              Nail Your Next Interview with <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                AI-Powered Simulation
              </span>
            </h1>
            
            <p className="text-xl text-gray-600 dark:text-neutral-400 mb-8 max-w-2xl mx-auto leading-relaxed">
              AceMock AI provides hyper-realistic interview practice for developers, designers, and managers. 
              Get instant feedback, scores, and improvement tips from our advanced Gemini model.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Link 
                to="/interview-form" 
                className="w-full sm:w-auto px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg hover:bg-blue-700 transform transition hover:scale-105 shadow-xl shadow-blue-200 dark:shadow-none"
              >
                Start Your Free Interview
              </Link>
              <Link 
                to={token ? "/dashboard" : "/signup"} 
                className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 border border-gray-200 dark:border-neutral-800 rounded-2xl font-bold text-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition"
              >
                View Dashboard
              </Link>
            </div>
          </div>
        </section>

        <section id="features" className="bg-gray-50 dark:bg-neutral-950/50 py-16 transition-colors duration-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold mb-4 text-slate-900 dark:text-neutral-100">Why choose AceMock AI?</h2>
              <p className="text-gray-500 dark:text-neutral-400">Built for high-stakes career moves</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  title: "Real-time AI Feedback",
                  desc: "Our Gemini-powered engine analyzes your voice, tone, and content instantly.",
                  icon: "🤖"
                },
                {
                  title: "Technical Coding Support",
                  desc: "Solve coding challenges on our integrated editor while explaining your logic.",
                  icon: "💻"
                },
                {
                  title: "Speech-to-Text Analysis",
                  desc: "Review your full transcript and see exactly where you can improve.",
                  icon: "🎙️"
                }
              ].map((f, i) => (
                <div key={i} className="bg-white dark:bg-neutral-900 p-8 rounded-3xl border border-gray-100 dark:border-neutral-800 hover:shadow-xl dark:hover:shadow-slate-950/50 transition-all">
                  <div className="text-4xl mb-4">{f.icon}</div>
                  <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-neutral-100">{f.title}</h3>
                  <p className="text-gray-500 dark:text-neutral-400">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default Home;
