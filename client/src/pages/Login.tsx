import React from 'react';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/');
  };

  return (
    <div className="bg-surface-background text-on-surface min-h-screen flex flex-col items-center justify-center p-6 antialiased">
      <div className="w-full max-w-[420px] flex flex-col items-center">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-12 h-12 rounded-lg bg-surface-card border border-surface-border flex items-center justify-center mb-6 shadow-sm">
            <span className="material-symbols-outlined text-primary text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>security</span>
          </div>
          <h1 className="font-headline-md text-headline-md text-text-primary mb-2">Sign in to Cerberus</h1>
          <p className="font-body-sm text-body-sm text-text-secondary">Enter your credentials to access the API Guardian dashboard.</p>
        </div>

        <div className="w-full bg-surface-card border border-surface-border rounded-xl p-8 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-surface-border to-transparent opacity-50"></div>

          <form className="flex flex-col space-y-5" onSubmit={handleLogin}>
            <div className="flex flex-col space-y-2">
              <label className="font-body-sm text-body-sm text-text-secondary font-medium" htmlFor="email">Email address</label>
              <input className="bg-surface border border-surface-border rounded text-text-primary font-body-base text-body-base px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 placeholder-surface-border placeholder-opacity-50" id="email" name="email" placeholder="admin@cerberus.io" required type="email"/>
            </div>

            <div className="flex flex-col space-y-2">
              <div className="flex justify-between items-center">
                <label className="font-body-sm text-body-sm text-text-secondary font-medium" htmlFor="password">Password</label>
                <button
                  type="button"
                  className="font-body-sm text-body-sm text-primary hover:text-primary-fixed-dim transition-colors duration-200 bg-transparent border-0 p-0 cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <input className="bg-surface border border-surface-border rounded text-text-primary font-body-base text-body-base px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200" id="password" name="password" placeholder="••••••••" required type="password"/>
            </div>

            <div className="pt-4">
              <button className="w-full bg-primary-container hover:bg-primary text-on-primary-container font-body-base text-body-base font-semibold py-3 px-4 rounded transition-all duration-200 flex items-center justify-center space-x-2" type="submit">
                <span>Login</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            </div>
          </form>
        </div>

        <div className="mt-8 text-center">
          <p className="font-body-sm text-body-sm text-text-secondary">
            Don&apos;t have an account?
            {' '}
            <button
              type="button"
              className="text-primary hover:text-primary-fixed-dim transition-colors duration-200 ml-1 bg-transparent border-0 p-0 cursor-pointer font-body-sm text-body-sm"
            >
              Contact your Administrator
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
