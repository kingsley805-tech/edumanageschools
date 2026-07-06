import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SchoolLoader() {
  const [progress, setProgress] = useState(0);
  const [dots, setDots] = useState('');
  const [loaded, setLoaded] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 1;
      });
    }, 8);

    return () => clearInterval(progressInterval);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 800);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (loaded) {
      navigate('/landing');
    }
  }, [loaded, navigate]);

  useEffect(() => {
    const dotsInterval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);

    return () => clearInterval(dotsInterval);
  }, []);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black text-white">
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute -left-[10%] -top-[10%] h-96 w-96 rounded-full bg-green-500/10 blur-[80px]"
          style={{ animation: 'float 6s ease-in-out infinite' }}
        />
        <div
          className="absolute -bottom-[15%] -right-[10%] h-80 w-80 rounded-full bg-green-500/5 blur-[100px]"
          style={{ animation: 'float 8s ease-in-out infinite reverse' }}
        />
      </div>

      <div className="relative z-10 text-center">
        <div className="relative mb-8 inline-block">
          <div
            className="relative mx-auto h-24 w-24"
            style={{ animation: 'bounce 2s ease-in-out infinite' }}
          >
            <div
              className="absolute inset-0 rounded-lg border border-green-500/30 bg-white shadow-2xl shadow-green-500/10"
              style={{ animation: 'pageFlip 2s ease-in-out infinite' }}
            >
              <div className="absolute left-1/2 top-0 h-full w-px bg-black/20" />
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="absolute left-3 right-3 h-px bg-black/15"
                  style={{ top: `${20 + i * 12}%` }}
                />
              ))}
            </div>

            <div
              className="absolute -right-6 -top-6 h-12 w-12"
              style={{ animation: 'float 3s ease-in-out infinite' }}
            >
              <div
                className="relative h-full w-full bg-green-500"
                style={{
                  clipPath: 'polygon(50% 0%, 0% 50%, 50% 50%, 100% 50%)',
                }}
              >
                <div
                  className="absolute left-1/2 top-1/2 h-8 w-8 rounded-full bg-green-400"
                  style={{ transform: 'translate(-50%, -25%)' }}
                />
              </div>
              <div
                className="absolute bottom-0 left-1/2 h-4 w-px bg-green-400/70"
                style={{ transform: 'translateX(-50%)' }}
              >
                <div
                  className="absolute bottom-0 left-1/2 h-2 w-2 rounded-full bg-green-400/70"
                  style={{ transform: 'translateX(-50%)' }}
                />
              </div>
            </div>
          </div>
        </div>

        <h1
          className="mb-2 text-4xl font-bold text-white"
          style={{ animation: 'fadeInUp 0.8s ease-out' }}
        >
          School <span className="text-green-400">Management</span> System
        </h1>

        <p
          className="mb-8 text-lg text-white/60"
          style={{ animation: 'fadeInUp 0.8s ease-out 0.2s backwards' }}
        >
          Loading{dots}
        </p>

        <div
          className="mx-auto mb-4 w-80"
          style={{ animation: 'fadeInUp 0.8s ease-out 0.4s backwards' }}
        >
          <div className="h-2 overflow-hidden rounded-full bg-white/15 shadow-inner">
            <div
              className="relative h-full rounded-full bg-green-500 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            >
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  background: 'linear-gradient(90deg, transparent, white, transparent)',
                  animation: 'shimmer 2s infinite',
                }}
              />
            </div>
          </div>
          <p className="mt-2 text-sm font-medium text-green-400">{progress}%</p>
        </div>

        <div className="mt-8 flex justify-center gap-6">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-3 w-3 rounded-full bg-green-500"
              style={{
                animation: 'pulse 1.5s ease-in-out infinite',
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }

        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        @keyframes pageFlip {
          0%, 100% { transform: rotateY(0deg); }
          50% { transform: rotateY(10deg); }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.5);
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
}
