import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';

const Payment: React.FC = () => {
  const { profile } = useAuth();
  const selectedPlan = sessionStorage.getItem('selected_plan') || 'Monthly';
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'upi' | 'card' | 'wallet'>('upi');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const planPrice = selectedPlan === 'Monthly' ? '2,000' : '12,000';

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setShowSuccess(true);
      setTimeout(() => navigate('/dashboard'), 2500);
    }, 2000);
  };

  if (!profile) return null;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-16 transition-colors duration-200">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Panel: Summary */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-xl p-10 transition-colors">
              <div className="flex items-center gap-3 mb-8">
                <div className="bg-blue-600 text-white p-2 rounded-xl">
                  <span className="block font-black text-xs">AM</span>
                </div>
                <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter">AceMock Secure</h2>
              </div>

              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Plan Summary</p>
                  <div className="flex justify-between items-end">
                    <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100">{selectedPlan} Plan</h3>
                    <span className="text-blue-600 dark:text-blue-400 font-black">₹{planPrice}</span>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-50 dark:border-slate-700">
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Customer Details</p>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-900 rounded-2xl flex items-center justify-center text-xl">
                      👤
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-slate-100">{profile.name}</p>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{profile.email}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-50 dark:border-slate-700 flex justify-between items-center">
                  <p className="text-sm font-black text-slate-900 dark:text-slate-100">Order Total</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-slate-100">₹{planPrice}</p>
                </div>
              </div>

              <div className="mt-10 p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">256-bit SSL Secure Payment</p>
              </div>
            </div>
          </div>

          {/* Right Panel: Payment Options */}
          <div className="lg:col-span-7">
            <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-xl overflow-hidden transition-colors">
              {/* Tab Header */}
              <div className="flex border-b border-slate-100 dark:border-slate-700">
                {[
                  { id: 'upi', label: 'UPI / QR', icon: '⚡' },
                  { id: 'card', label: 'Card', icon: '💳' },
                  { id: 'wallet', label: 'Wallet', icon: '👛' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 flex flex-col items-center justify-center py-6 gap-1 transition-all ${
                      activeTab === tab.id 
                      ? 'bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600' 
                      : 'text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <span className="text-lg">{tab.icon}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
                  </button>
                ))}
              </div>

              <div className="p-10">
                {activeTab === 'upi' && (
                  <div className="text-center animate-in fade-in duration-300">
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 inline-block shadow-inner mb-6">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=AceMock_Payment_Sample`} 
                        alt="QR Code" 
                        className="w-40 h-40"
                      />
                    </div>
                    <p className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest mb-2">Scan to Pay</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-8">Pay using any UPI app like GPay, PhonePe, or Paytm</p>
                    
                    <div className="flex justify-center gap-4">
                      <div className="w-10 h-10 bg-slate-50 dark:bg-slate-900 rounded-lg p-2 border border-slate-100 dark:border-slate-700 grayscale hover:grayscale-0 transition-all cursor-pointer">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/e/e1/UPI-Logo-vector.svg" alt="UPI" />
                      </div>
                      <div className="w-10 h-10 bg-slate-50 dark:bg-slate-900 rounded-lg p-2 border border-slate-100 dark:border-slate-700 grayscale hover:grayscale-0 transition-all cursor-pointer">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/c/c4/Google_Pay_Logo.svg" alt="GPay" />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'card' && (
                  <form onSubmit={handlePay} className="space-y-6 animate-in fade-in duration-300">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Card Holder Name</label>
                      <input type="text" required placeholder="John Doe" className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-600 dark:text-slate-100 font-bold" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Card Number</label>
                      <input type="text" required placeholder="XXXX XXXX XXXX XXXX" className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-600 dark:text-slate-100 font-bold" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Expiry Date</label>
                        <input type="text" required placeholder="MM/YY" className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-600 dark:text-slate-100 font-bold" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">CVV</label>
                        <input type="password" required placeholder="XXX" maxLength={3} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-600 dark:text-slate-100 font-bold" />
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                       <label className="flex items-center gap-2 cursor-pointer">
                         <input type="checkbox" className="w-4 h-4 rounded text-blue-600" />
                         <span className="text-xs font-bold text-slate-500">Save card for future payments</span>
                       </label>
                    </div>

                    <button 
                      type="submit"
                      disabled={isProcessing}
                      className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-sm tracking-widest hover:bg-blue-700 transition shadow-xl shadow-blue-500/20 active:scale-95 disabled:opacity-50"
                    >
                      {isProcessing ? 'Processing...' : `Pay ₹${planPrice}`}
                    </button>
                  </form>
                )}

                {activeTab === 'wallet' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-6 text-center">Select your preferred digital wallet</p>
                    <div className="grid grid-cols-2 gap-4">
                      {['Paytm', 'Amazon Pay', 'PhonePe', 'MobiKwik'].map(wallet => (
                        <button key={wallet} className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl flex items-center justify-center font-bold text-slate-900 dark:text-slate-100 hover:border-blue-600 transition-all">
                          {wallet}
                        </button>
                      ))}
                    </div>
                    <button 
                      onClick={() => setIsProcessing(true)}
                      className="w-full py-5 mt-8 bg-slate-900 dark:bg-slate-700 text-white rounded-2xl font-black uppercase text-sm tracking-widest hover:bg-black transition shadow-xl active:scale-95"
                    >
                      {isProcessing ? 'Connecting...' : 'Pay with Wallet'}
                    </button>
                  </div>
                )}

                {activeTab === 'upi' && (
                  <button 
                    onClick={() => setIsProcessing(true)}
                    className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-sm tracking-widest hover:bg-blue-700 transition shadow-xl shadow-blue-500/20 active:scale-95"
                  >
                    {isProcessing ? 'Processing...' : `Pay ₹${planPrice}`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Processing / Success Modal */}
      {(isProcessing || showSuccess) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"></div>
          <div className="relative bg-white dark:bg-slate-800 rounded-[3rem] p-12 max-w-sm w-full text-center shadow-2xl border border-slate-100 dark:border-slate-700">
            {isProcessing ? (
              <>
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mb-2">Authorizing Payment</h3>
                <p className="text-slate-500 dark:text-slate-400 font-medium">Please do not refresh the page...</p>
              </>
            ) : (
              <div className="animate-in zoom-in duration-300">
                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
                  ✓
                </div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mb-2">Payment Successful!</h3>
                <p className="text-slate-500 dark:text-slate-400 font-medium mb-6">Welcome to AceMock {selectedPlan}. Your features are unlocked.</p>
                <div className="w-8 h-8 border-4 border-emerald-500 dark:border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Payment;
