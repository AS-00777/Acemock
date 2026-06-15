
import React, { useState, useMemo } from 'react';
import Layout from '../components/Layout';

interface FAQItemProps {
  question: string;
  answer: string;
  score: number;
}

const FAQItem: React.FC<FAQItemProps> = ({ question, answer, score }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Score color logic
  const getScoreColor = (s: number) => {
    if (s >= 80) return 'bg-emerald-500';
    if (s >= 40) return 'bg-amber-500';
    return 'bg-slate-300 dark:bg-neutral-700';
  };

  return (
    <div className="border-b border-slate-100 dark:border-neutral-800 last:border-0 overflow-hidden">
      {/* Relevance Bar - Only shown if searching */}
      {score > 0 && (
        <div className="pt-4 px-1">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[9px] font-black uppercase text-slate-400 dark:text-neutral-400 tracking-widest">
              Match Relevance
            </span>
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded text-white ${getScoreColor(score)}`}>
              {score}%
            </span>
          </div>
          <div className="w-full h-1 bg-slate-100 dark:bg-neutral-800 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ease-out ${getScoreColor(score)}`}
              style={{ width: `${score}%` }}
            ></div>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-6 flex items-center justify-between text-left focus:outline-none group transition-colors"
      >
        <span className="text-lg font-bold text-slate-900 dark:text-neutral-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
          {question}
        </span>
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-blue-600' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className={`transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-40 opacity-100 pb-6' : 'max-h-0 opacity-0'
        }`}
      >
        <p className="text-slate-600 dark:text-neutral-400 font-medium leading-relaxed">
          {answer}
        </p>
      </div>
    </div>
  );
};

const Help: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  
  const faqs = useMemo(() => [
    {
      question: "How do I upgrade my plan?",
      answer: "Go to the Pricing page from the main menu, select your preferred plan, and follow the secure checkout instructions."
    },
    {
      question: "What happens after clicking Upgrade?",
      answer: "You will be redirected to a secure payment gateway. After completion, your account status and interview limits update instantly."
    },
    {
      question: "Payment failed — what should I do?",
      answer: "Verify your card details or try an alternative method like UPI. If the problem persists, contact your bank or reach out to our support team."
    },
    {
      question: "How many free interviews do I get in Basic?",
      answer: "The Basic plan includes 10 AI-generated Mock Interviews and 2 Resume-based Interviews for free upon registration."
    },
    {
      question: "What is included in the Monthly plan?",
      answer: "You get 30 Mock Interviews, 10 Resume Interviews, enhanced feedback, and priority AI processing every month."
    },
    {
      question: "What is included in the Pro / Yearly plan?",
      answer: "Unlock unlimited Mock and Resume interviews, advanced coding analysis, and deep personal brand insights for a full year."
    },
    {
      question: "How do I cancel or change my subscription?",
      answer: "Manage your billing cycles and plans directly in Account Settings. Cancellations take effect at the end of your current term."
    },
    {
      question: "Is my payment secure?",
      answer: "Yes, we use 256-bit SSL encryption and trusted partners like Stripe and Razorpay. We never store your raw card details."
    }
  ], []);

  const suggestions = [
    "Upgrade Plan",
    "Payment Failed",
    "Subscription",
    "Pro Features",
    "Basic Limits"
  ];

  const calculateRelevance = (faq: { question: string, answer: string }, query: string) => {
    if (!query) return 0;
    const q = query.toLowerCase().trim();
    const target = (faq.question + " " + faq.answer).toLowerCase();
    
    if (target.includes(q)) {
      // Direct match gets high score based on coverage
      const coverage = (q.length / faq.question.length) * 30;
      return Math.min(100, Math.round(70 + coverage));
    }
    
    // Partial word match
    const words = q.split(/\s+/).filter(w => w.length > 2);
    if (words.length === 0) return 0;
    
    let matches = 0;
    words.forEach(word => { if (target.includes(word)) matches++; });
    
    if (matches > 0) return Math.round((matches / words.length) * 50);
    return 0;
  };

  const filteredFaqs = useMemo(() => {
    if (!searchQuery.trim()) return faqs.map(f => ({ ...f, score: 0 }));

    return faqs
      .map(f => ({
        ...f,
        score: calculateRelevance(f, searchQuery)
      }))
      .filter(f => f.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [searchQuery, faqs]);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-20">
        {/* Header & Search */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-neutral-100 mb-6 font-poppins tracking-tight">
            Billing & Payments Help
          </h1>
          <div className="relative max-w-lg mx-auto">
            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-slate-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search: upgrade, payment, plan…"
              className="w-full bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl py-4 pl-14 pr-6 outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-slate-900 dark:text-neutral-100 font-bold transition-all shadow-sm"
            />
          </div>

          {/* Suggestion Buttons */}
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {suggestions.map((tag) => (
              <button
                key={tag}
                onClick={() => setSearchQuery(tag)}
                className="px-4 py-2 bg-slate-100 dark:bg-neutral-900 text-slate-600 dark:text-neutral-400 text-[11px] font-black uppercase tracking-widest rounded-xl border border-transparent hover:border-blue-200 dark:hover:border-blue-800 hover:text-blue-600 dark:hover:text-blue-400 transition-all active:scale-95"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* FAQ List */}
        <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] p-8 md:p-12 border border-slate-100 dark:border-neutral-800 shadow-sm transition-colors mb-10">
          <div className="space-y-1">
            {filteredFaqs.length > 0 ? (
              filteredFaqs.map((faq, index) => (
                <FAQItem 
                  key={index} 
                  question={faq.question} 
                  answer={faq.answer} 
                  score={faq.score}
                />
              ))
            ) : (
              <div className="py-12 text-center">
                <p className="text-slate-500 dark:text-neutral-400 font-bold">
                  No results found. Contact <a href="mailto:support@yourapp.com" className="text-blue-600 dark:text-blue-400 hover:underline">support@yourapp.com</a>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center space-y-4">
          <p className="text-slate-500 dark:text-neutral-400 font-medium text-sm">
            For more help contact: <a href="mailto:support@yourapp.com" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">support@yourapp.com</a>
          </p>
          <p className="text-[11px] text-slate-400 dark:text-neutral-400 font-black uppercase tracking-[0.2em]">
            Your personal data is secure and never shared with third parties.
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default Help;
