import React, { useState, useEffect } from 'react';
import Landing from './Landing';

export default function SchoolLoader() {
  const [progress, setProgress] = useState(0);
  const [dots, setDots] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Show loader for 10 seconds (10000ms)
    const t = setTimeout(() => setLoaded(true), 10000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    // Complete progress bar in 10 seconds (10000ms / 100 = 100ms per percent)
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 1;
      });
    }, 100);

    return () => clearInterval(progressInterval);
  }, []);

  useEffect(() => {
    const dotsInterval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);

    return () => clearInterval(dotsInterval);
  }, []);

  if (loaded) return <Landing />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-blue-50 flex items-center justify-center overflow-hidden relative">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-96 h-96 rounded-full opacity-10" style={{ background: '#1E3A8A', top: '-10%', left: '-10%', animation: 'float 6s ease-in-out infinite' }} />
        <div className="absolute w-80 h-80 rounded-full opacity-10" style={{ background: '#1E3A8A', bottom: '-15%', right: '-10%', animation: 'float 8s ease-in-out infinite reverse' }} />
      </div>

      <div className="relative z-10 text-center">
        <div className="mb-8 relative inline-block">
          <div className="w-40 h-40 mx-auto relative" style={{ animation: 'bounce 2s ease-in-out infinite' }}>
            <div className="absolute inset-0 rounded-lg shadow-2xl" style={{ background: '#1E3A8A', animation: 'pageFlip 2s ease-in-out infinite' }}>
              <div className="absolute top-0 left-1/2 w-px h-full bg-white opacity-30" />
              {[...Array(5)].map((_, i) => (
                <div key={i} className="absolute left-3 right-3 h-px bg-white opacity-20" style={{ top: `${20 + i * 12}%` }} />
              ))}
            </div>

            <div className="absolute -top-8 -right-8 w-16 h-16" style={{ animation: 'float 3s ease-in-out infinite' }}>
              <div className="w-full h-full relative" style={{ background: '#1E3A8A', clipPath: 'polygon(50% 0%, 0% 50%, 50% 50%, 100% 50%)' }}>
                <div className="absolute w-8 h-8 rounded-full" style={{ background: '#1E3A8A', top: '50%', left: '50%', transform: 'translate(-50%, -25%)' }} />
              </div>
              <div className="absolute bottom-0 left-1/2 w-px h-4 bg-yellow-500" style={{ transform: 'translateX(-50%)' }}>
                <div className="absolute bottom-0 left-1/2 w-2 h-2 rounded-full bg-yellow-500" style={{ transform: 'translateX(-50%)' }} />
              </div>
            </div>
          </div>
        </div>

        <h1 className="text-4xl font-bold mb-2" style={{ color: '#1E3A8A', animation: 'fadeInUp 0.8s ease-out' }}>
          School Management System
        </h1>

        <p className="text-lg mb-8 text-gray-600" style={{ animation: 'fadeInUp 0.8s ease-out 0.2s backwards' }}>
          Loading{dots}
        </p>

        <div className="w-80 mx-auto mb-4" style={{ animation: 'fadeInUp 0.8s ease-out 0.4s backwards' }}>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden shadow-inner">
            <div className="h-full rounded-full transition-all duration-300 ease-out relative overflow-hidden" style={{ width: `${progress}%`, background: `linear-gradient(90deg, #1E3A8A 0%, #3B82F6 100%)` }}>
              <div className="absolute inset-0 opacity-30" style={{ background: 'linear-gradient(90deg, transparent, white, transparent)', animation: 'shimmer 2s infinite' }} />
            </div>
          </div>
          <p className="text-sm mt-2 font-medium" style={{ color: '#1E3A8A' }}>
            {progress}%
          </p>
        </div>

        <div className="flex justify-center gap-6 mt-8">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-3 h-3 rounded-full" style={{ background: '#1E3A8A', animation: `pulse 1.5s ease-in-out infinite`, animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes float { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-20px) rotate(5deg); } }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes pageFlip { 0%, 100% { transform: rotateY(0deg); } 50% { transform: rotateY(10deg); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.5); opacity: 0.5; } }
      `}</style>
    </div>
  );
}


