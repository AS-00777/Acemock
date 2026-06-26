import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import Layout from '../components/Layout';

const titleFromPath = (pathname: string) => {
  const lastSegment = pathname.split('/').filter(Boolean).pop() || 'feature';
  return lastSegment
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const ComingSoon: React.FC = () => {
  const { pathname } = useLocation();
  const title = titleFromPath(pathname);

  return (
    <Layout>
      <main className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-4xl items-center px-4 py-16 sm:px-6">
        <section className="w-full rounded-[2rem] border border-slate-100 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-10">
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-600 dark:text-blue-400">AceMock AI</span>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 dark:text-neutral-100 sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-base font-medium leading-relaxed text-slate-500 dark:text-neutral-400 sm:text-lg">
            This workspace is wired into navigation and ready for the product flow. The full experience can now be built without changing the route structure.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/dashboard" className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-blue-600 px-6 text-sm font-black text-white transition hover:bg-blue-700">
              Go to Dashboard
            </Link>
            <Link to="/aptitude" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 px-6 text-sm font-black text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-neutral-700 dark:text-neutral-200 dark:hover:border-blue-900 dark:hover:bg-blue-950/30 dark:hover:text-blue-300">
              Back to Aptitude
            </Link>
          </div>
        </section>
      </main>
    </Layout>
  );
};

export default ComingSoon;
