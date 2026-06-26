import type { ReactNode } from "react";
import { SignIn, SignUp, useAuth } from "@clerk/clerk-react";
import { Link, Navigate } from "react-router-dom";
import Layout from "../components/Layout";

const redirectUrl = "/dashboard";

const clerkAppearance = {
  variables: {
    colorPrimary: "#2563eb",
    colorText: "#0f172a",
    colorTextSecondary: "#64748b",
    colorBackground: "transparent",
    colorInputBackground: "#f8fafc",
    colorInputText: "#0f172a",
    borderRadius: "1.25rem",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  },
  elements: {
    rootBox: "w-full",
    card: "w-full bg-transparent shadow-none border-0 p-0",
    cardBox: "w-full bg-transparent shadow-none border-0",
    header: "hidden",
    footer: "hidden",
    footerAction: "hidden",
    footerActionText: "text-slate-500",
    footerActionLink:
      "text-blue-600 hover:text-blue-700 font-black transition-colors",
    form: "space-y-5 px-1",
    formField: "space-y-2",
    formFieldLabel:
      "text-[11px] font-black uppercase tracking-widest text-slate-500",
    formFieldInputContainer: "w-full overflow-visible rounded-2xl",
    formFieldInputWrapper: "w-full overflow-visible rounded-2xl",
    formFieldInput:
      "h-12 w-full min-w-0 box-border rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base sm:text-sm font-bold text-slate-950 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/15",
    formFieldInputShowPasswordButton:
      "text-slate-400 hover:text-slate-700 transition-colors",
    formFieldAction:
      "text-xs font-black text-blue-600 hover:text-blue-700 transition-colors",
    formButtonPrimary:
      "h-12 rounded-2xl bg-blue-600 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-blue-500/20 transition-all hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/25 active:scale-[0.99]",
    socialButtons: "grid gap-3 px-1",
    socialButtonsBlockButton:
      "h-12 rounded-2xl border border-blue-100 bg-blue-50/70 text-slate-800 shadow-sm transition-all hover:border-blue-200 hover:bg-blue-100/70",
    socialButtonsBlockButtonText:
      "text-sm font-black text-slate-800 truncate",
    socialButtonsBlockButtonArrow: "text-slate-400",
    dividerRow: "px-1",
    dividerLine: "bg-slate-200",
    dividerText:
      "px-3 text-[10px] font-black uppercase tracking-widest text-slate-400",
    identityPreview:
      "rounded-2xl border border-slate-200 bg-slate-50 text-slate-900",
    identityPreviewText: "text-slate-900 font-bold",
    identityPreviewEditButton:
      "text-blue-600 hover:text-blue-700 transition-colors",
    formResendCodeLink:
      "text-blue-600 hover:text-blue-700 font-black transition-colors",
    otpCodeFieldInput:
      "rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:border-blue-500 focus:ring-blue-500/15",
    alert: "auth-clerk-alert rounded-2xl border border-red-100 bg-red-50 text-red-700",
    alertText: "text-sm font-semibold text-red-700",
    formFieldErrorText: "text-sm font-semibold text-red-600",
    formFieldSuccessText: "text-sm font-semibold text-emerald-600",
    alternativeMethodsBlockButton:
      "rounded-2xl border border-blue-100 bg-blue-50/70 text-slate-900 hover:bg-blue-100/70",
    alternativeMethodsBlockButtonText: "font-bold text-slate-900",
    footerPages: "hidden",
    footerPage: "hidden",
    footerPageLink: "hidden",
    footerPageText: "hidden",
    footerPageLogo: "hidden",
    footerPageLogoImage: "hidden",
    navbar: "hidden",
    main: "auth-clerk-main gap-5",
  },
};

type AuthShellProps = {
  children: ReactNode;
  eyebrow: string;
  title: string;
  helper: string;
  switchText?: string;
  switchHref?: string;
  switchLabel?: string;
};

const AuthShell = ({ children, eyebrow, title, helper, switchText, switchHref, switchLabel }: AuthShellProps) => (
  <AuthRouteGuard>
    <Layout>
      <section className="auth-viewport auth-page relative min-h-screen overflow-hidden bg-slate-50/30 px-4 py-8 text-slate-900 dark:bg-neutral-950 sm:px-6 lg:px-8">
        <div className="auth-page-decoration absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.08),transparent_32%)] dark:bg-none" />
        <div className="auth-page-decoration absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent dark:via-neutral-800" />

        <div className="relative mx-auto grid min-h-full w-full max-w-6xl items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <aside className="hidden lg:block">
            <div className="max-w-lg">
              <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-700 shadow-xl shadow-slate-200/60 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:shadow-none">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white shadow-lg shadow-blue-600/30">
                  AM
                </span>
                AceMock AI
              </div>
              <h1 className="font-poppins text-5xl font-black leading-tight tracking-tight text-slate-950 dark:text-neutral-100 xl:text-6xl">
                Practice Smarter. Interview Better.
              </h1>
              <p className="mt-6 max-w-md text-lg font-semibold leading-8 text-slate-600 dark:text-neutral-400">
                AI-powered mock interviews with real-time feedback, scoring, and improvement insights.
              </p>
              <div className="mt-10 grid max-w-md grid-cols-3 gap-4">
                {[
                  ["Real-time", "AI Feedback"],
                  ["Smart", "Scoring"],
                  ["Growth", "Insights"],
                ].map(([lineOne, lineTwo]) => (
                  <div
                    key={`${lineOne}-${lineTwo}`}
                    className="min-h-24 rounded-2xl border border-slate-200 bg-white px-4 py-5 text-center shadow-xl shadow-slate-200/60 transition-all dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none"
                  >
                    <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
                      {lineOne}
                    </span>
                    <span className="mt-1 block text-sm font-black leading-snug text-slate-800 dark:text-neutral-100">
                      {lineTwo}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <div className="mx-auto flex w-full max-w-md flex-col justify-center sm:max-w-lg lg:ml-auto">
            <div className="mb-6 text-center lg:hidden">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-xs font-black text-white shadow-lg shadow-blue-600/30">
                AM
              </div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-blue-600 dark:text-blue-400">
                AceMock AI
              </p>
              <h1 className="mt-3 font-poppins text-3xl font-black leading-tight text-slate-950 dark:text-neutral-100 sm:text-4xl">
                Practice Smarter. Interview Better.
              </h1>
              <p className="mx-auto mt-3 max-w-sm text-sm font-semibold leading-6 text-slate-600 dark:text-neutral-400">
                AI-powered mock interviews with real-time feedback, scoring, and improvement insights.
              </p>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-200/70 sm:rounded-[2.5rem] sm:p-8 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
              <div className="mb-7">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-600 dark:text-blue-400">
                  {eyebrow}
                </p>
                <h2 className="mt-3 font-poppins text-2xl font-black tracking-tight text-slate-950 dark:text-neutral-100 sm:text-3xl">
                  {title}
                </h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500 dark:text-neutral-400">
                  {helper}
                </p>
              </div>
              <div className="auth-form-slot">{children}</div>
              {switchHref && switchText && switchLabel && (
                <div className="mt-6 text-center text-sm font-semibold text-slate-500 dark:text-neutral-400">
                  {switchText}{" "}
                  <Link to={switchHref} className="font-black text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                    {switchLabel}
                  </Link>
                </div>
              )}
              <div className="mt-5 border-t border-slate-100 pt-4 text-center text-[11px] font-bold text-slate-400 dark:border-neutral-800 dark:text-neutral-500">
                Secured by <span className="font-black text-slate-500 dark:text-neutral-400">Clerk</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  </AuthRouteGuard>
);

const AuthRouteGuard = ({ children }: { children: ReactNode }) => {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <Layout>
        <section className="auth-viewport flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-900 dark:bg-neutral-950 dark:text-neutral-100">
          <div className="w-full max-w-xs rounded-2xl border border-slate-200 bg-white px-4 py-4 text-center text-xs font-black uppercase tracking-wider text-slate-500 shadow-2xl shadow-slate-200/60 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:shadow-none sm:text-sm sm:tracking-widest">
            Loading secure sign in...
          </div>
        </section>
      </Layout>
    );
  }

  if (isSignedIn) {
    return <Navigate to={redirectUrl} replace />;
  }

  return <>{children}</>;
};

export const Login = () => (
  <AuthShell
    eyebrow="Welcome back"
    title="Sign in to continue"
    helper="Use email, Google, or LinkedIn to open your interview workspace."
    switchText="Don't have an account?"
    switchHref="/signup"
    switchLabel="Sign up"
  >
    <SignIn
      routing="path"
      path="/login"
      signUpUrl="/signup"
      fallbackRedirectUrl={redirectUrl}
      appearance={clerkAppearance}
    />
  </AuthShell>
);

export const Signup = () => (
  <AuthShell
    eyebrow="Start practicing"
    title="Create your account"
    helper="Join AceMock AI and begin building interview confidence."
    switchText="Already have an account?"
    switchHref="/login"
    switchLabel="Sign in"
  >
    <SignUp
      routing="path"
      path="/signup"
      signInUrl="/login"
      fallbackRedirectUrl={redirectUrl}
      appearance={clerkAppearance}
    />
  </AuthShell>
);

export const ForgotPassword = () => (
  <AuthShell
    eyebrow="Account recovery"
    title="Reset your password"
    helper="Enter your account email and Clerk will guide the recovery flow."
    switchText="Remembered your password?"
    switchHref="/login"
    switchLabel="Sign in"
  >
    <SignIn
      routing="path"
      path="/forgot-password"
      signUpUrl="/signup"
      fallbackRedirectUrl={redirectUrl}
      appearance={clerkAppearance}
    />
  </AuthShell>
);

export const ResetPassword = () => (
  <AuthShell
    eyebrow="Set new password"
    title="Complete password reset"
    helper="Finish the secure Clerk reset flow and return to your dashboard."
    switchText="Back to account access?"
    switchHref="/login"
    switchLabel="Sign in"
  >
    <SignIn
      routing="path"
      path="/reset-password"
      signUpUrl="/signup"
      fallbackRedirectUrl={redirectUrl}
      appearance={clerkAppearance}
    />
  </AuthShell>
);
