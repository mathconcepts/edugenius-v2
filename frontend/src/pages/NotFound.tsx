import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="min-h-screen bg-surface-950 flex flex-col items-center justify-center text-center px-4">
      <div className="text-8xl mb-6">🔭</div>
      <h1 className="text-4xl font-bold text-white mb-2">Page not found</h1>
      <p className="text-surface-400 mb-8">This page doesn't exist — or maybe it's still being built.</p>
      <Link to="/" className="btn-primary">Back to Dashboard</Link>
    </div>
  );
}
