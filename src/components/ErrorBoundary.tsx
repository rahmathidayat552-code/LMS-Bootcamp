import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg text-center">
            <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Terjadi Kesalahan</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Maaf, terjadi kesalahan yang tidak terduga pada aplikasi.
            </p>
            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded text-left overflow-auto text-sm text-gray-800 dark:text-gray-200 mb-6">
              <code>{this.state.error?.message}</code>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
