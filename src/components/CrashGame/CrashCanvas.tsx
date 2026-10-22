import React, { useRef, useEffect } from 'react';

interface CrashCanvasProps {
  status: 'betting' | 'flying' | 'crashed';
  currentMultiplier: number;
  finalCrashPoint?: number;
  countdownSeconds: number;
}

export const CrashCanvas: React.FC<CrashCanvasProps> = ({
  status,
  currentMultiplier,
  finalCrashPoint,
  countdownSeconds,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Particles for thruster fire & crash blast
  const particlesRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number }>>([]);
  const starsRef = useRef<Array<{ x: number; y: number; r: number; alpha: number }>>([]);

  // Initialize background stars once
  useEffect(() => {
    const stars = [];
    for (let i = 0; i < 70; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random(),
        r: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.7 + 0.3,
      });
    }
    starsRef.current = stars;
  }, []);

  // Main canvas rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // 1. Dark navy background
      ctx.fillStyle = '#090d1a';
      ctx.fillRect(0, 0, width, height);

      // Subtle gradient overlay
      const grad = ctx.createLinearGradient(0, height, width, 0);
      grad.addColorStop(0, 'rgba(15, 23, 42, 0.9)');
      grad.addColorStop(1, 'rgba(30, 27, 75, 0.4)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // 2. Stars twinkling
      ctx.save();
      starsRef.current.forEach((star) => {
        ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha * 0.7})`;
        ctx.beginPath();
        ctx.arc(star.x * width, star.y * height, star.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();

      // 3. Grid lines & coordinate indicators
      ctx.save();
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      // Horizontal grid lines
      const hLines = 4;
      for (let i = 1; i <= hLines; i++) {
        const y = height - (height / (hLines + 1)) * i;
        ctx.beginPath();
        ctx.moveTo(30, y);
        ctx.lineTo(width - 20, y);
        ctx.stroke();
      }

      // Vertical grid lines
      const vLines = 5;
      for (let i = 1; i <= vLines; i++) {
        const x = 30 + ((width - 50) / (vLines + 1)) * i;
        ctx.beginPath();
        ctx.moveTo(x, 20);
        ctx.lineTo(x, height - 30);
        ctx.stroke();
      }
      ctx.restore();

      // Axes labels
      ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
      ctx.font = '10px monospace';
      ctx.fillText('1.00x', 8, height - 35);
      ctx.fillText('2.00x', 8, height * 0.65);
      ctx.fillText('5.00x', 8, height * 0.35);
      ctx.fillText('10.00x', 8, height * 0.12);

      const paddingLeft = 45;
      const paddingBottom = 40;
      const graphWidth = width - paddingLeft - 50;
      const graphHeight = height - paddingBottom - 50;

      // In flying or crashed state, render the curve and rocket
      if (status === 'flying' || status === 'crashed') {
        // Multiplier progression mapping
        // Progress runs smoothly: at mult 1.0 -> 0%, at mult 10 -> 80%, asymptotically reaching edges
        const multLog = Math.log2(Math.max(1, currentMultiplier));
        const maxLog = Math.log2(15);
        const progress = Math.min(0.92, Math.max(0.04, multLog / maxLog));

        const rocketX = paddingLeft + graphWidth * progress;
        // Exponential-like curve: y drops from bottom to top
        const curveFactor = Math.pow(progress, 1.4);
        const rocketY = height - paddingBottom - graphHeight * curveFactor;

        // Draw glowing curve from origin to rocket
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(paddingLeft, height - paddingBottom);

        // Quadratic curve interpolation
        const cpX = paddingLeft + (rocketX - paddingLeft) * 0.45;
        const cpY = height - paddingBottom - 10;
        ctx.quadraticCurveTo(cpX, cpY, rocketX, rocketY);

        // Glow
        ctx.shadowColor = status === 'crashed' ? '#ef4444' : '#eab308';
        ctx.shadowBlur = 14;
        ctx.strokeStyle = status === 'crashed' ? '#f87171' : '#facc15';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.restore();

        // Area under curve gradient
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(paddingLeft, height - paddingBottom);
        ctx.quadraticCurveTo(cpX, cpY, rocketX, rocketY);
        ctx.lineTo(rocketX, height - paddingBottom);
        ctx.closePath();
        const areaGrad = ctx.createLinearGradient(0, rocketY, 0, height - paddingBottom);
        if (status === 'crashed') {
          areaGrad.addColorStop(0, 'rgba(239, 68, 68, 0.25)');
          areaGrad.addColorStop(1, 'rgba(239, 68, 68, 0.0)');
        } else {
          areaGrad.addColorStop(0, 'rgba(234, 179, 8, 0.28)');
          areaGrad.addColorStop(1, 'rgba(234, 179, 8, 0.0)');
        }
        ctx.fillStyle = areaGrad;
        ctx.fill();
        ctx.restore();

        // Spawn thruster particles
        if (status === 'flying') {
          for (let p = 0; p < 3; p++) {
            particlesRef.current.push({
              x: rocketX - 12,
              y: rocketY + 8,
              vx: -Math.random() * 3 - 2,
              vy: Math.random() * 3 - 0.5,
              life: 1,
              maxLife: Math.random() * 20 + 15,
              color: Math.random() > 0.4 ? '#fb923c' : '#facc15',
              size: Math.random() * 3.5 + 1.5,
            });
          }
        } else if (status === 'crashed' && particlesRef.current.length < 50) {
          // Blast explosion particles
          for (let p = 0; p < 25; p++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 4 + 1;
            particlesRef.current.push({
              x: rocketX,
              y: rocketY,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              life: 1,
              maxLife: Math.random() * 30 + 20,
              color: ['#ef4444', '#f97316', '#fbbf24'][Math.floor(Math.random() * 3)],
              size: Math.random() * 4 + 2,
            });
          }
        }

        // Draw particles
        particlesRef.current = particlesRef.current.filter((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 1 / p.maxLife;

          if (p.life <= 0) return false;

          ctx.save();
          ctx.globalAlpha = p.life;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          return true;
        });

        // Draw Rocket if not crashed
        if (status === 'flying') {
          ctx.save();
          ctx.translate(rocketX, rocketY);
          // Angle tilts upward with ascent
          const angle = -Math.PI / 4 + (progress * 0.15);
          ctx.rotate(angle);

          // Rocket Body
          ctx.shadowColor = '#facc15';
          ctx.shadowBlur = 10;

          // Fuselage
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.ellipse(0, 0, 18, 7, 0, 0, Math.PI * 2);
          ctx.fill();

          // Nose cone (orange)
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.moveTo(14, -4);
          ctx.lineTo(24, 0);
          ctx.lineTo(14, 4);
          ctx.closePath();
          ctx.fill();

          // Wings
          ctx.fillStyle = '#0ea5e9';
          ctx.beginPath();
          ctx.moveTo(-6, -6);
          ctx.lineTo(-14, -13);
          ctx.lineTo(-4, -5);
          ctx.closePath();
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(-6, 6);
          ctx.lineTo(-14, 13);
          ctx.lineTo(-4, 5);
          ctx.closePath();
          ctx.fill();

          // Cockpit window
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.ellipse(6, -1, 4, 2.5, 0, 0, Math.PI * 2);
          ctx.fill();

          // Thruster flame
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.moveTo(-16, -3);
          ctx.lineTo(-26 - Math.random() * 6, 0);
          ctx.lineTo(-16, 3);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.moveTo(-16, -1.5);
          ctx.lineTo(-22 - Math.random() * 4, 0);
          ctx.lineTo(-16, 1.5);
          ctx.closePath();
          ctx.fill();

          ctx.restore();
        } else if (status === 'crashed') {
          // Crash blast ring
          ctx.save();
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(rocketX, rocketY, 20 + (Math.sin(Date.now() / 80) * 4), 0, Math.PI * 2);
          ctx.stroke();

          // Blast icon
          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 16px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('💥', rocketX, rocketY);
          ctx.restore();
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [status, currentMultiplier]);

  // Multiplier text color logic
  const getMultiplierColor = () => {
    if (status === 'crashed') return 'text-red-500';
    if (currentMultiplier >= 10) return 'text-amber-400 drop-shadow-[0_0_20px_rgba(251,191,36,0.8)]';
    if (currentMultiplier >= 2) return 'text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.7)]';
    return 'text-white';
  };

  return (
    <div className="relative w-full h-64 sm:h-72 rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl flex flex-col items-center justify-center select-none">
      <canvas
        ref={canvasRef}
        width={600}
        height={320}
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Center Dynamic HUD Display */}
      <div className="relative z-10 flex flex-col items-center justify-center pointer-events-none px-4">
        {status === 'betting' && (
          <div className="flex flex-col items-center animate-pulse">
            <div className="relative flex items-center justify-center">
              <svg className="w-24 h-24 transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="5"
                  fill="transparent"
                  className="text-slate-800"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="5"
                  fill="transparent"
                  strokeDasharray={251.2}
                  strokeDashoffset={251.2 - (251.2 * countdownSeconds) / 5}
                  className="text-amber-400 transition-all duration-200"
                />
              </svg>
              <div className="absolute text-2xl font-black font-mono text-amber-400">
                {countdownSeconds > 0 ? countdownSeconds.toFixed(1) : '0.0'}s
              </div>
            </div>
            <span className="text-xs uppercase font-bold tracking-widest text-slate-300 mt-2 bg-slate-900/80 px-3 py-1 rounded-full border border-slate-700">
              Accepting Bets
            </span>
          </div>
        )}

        {status === 'flying' && (
          <div className="flex flex-col items-center">
            <div className={`text-4xl sm:text-6xl font-black font-mono tracking-tight transition-transform duration-75 ${getMultiplierColor()}`}>
              {currentMultiplier.toFixed(2)}x
            </div>
            <div className="flex items-center gap-1.5 mt-1 bg-slate-900/80 backdrop-blur-md px-3 py-0.5 rounded-full border border-amber-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[11px] font-bold tracking-wider text-amber-300 uppercase">
                Ascending...
              </span>
            </div>
          </div>
        )}

        {status === 'crashed' && (
          <div className="flex flex-col items-center animate-bounce">
            <div className="text-3xl sm:text-5xl font-black font-mono tracking-tight text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]">
              FLEW AWAY @ {(finalCrashPoint || currentMultiplier).toFixed(2)}x
            </div>
            <div className="mt-1 bg-red-950/80 border border-red-500/40 px-3 py-1 rounded-full text-xs font-bold text-red-200 uppercase tracking-widest">
              Crashed
            </div>
          </div>
        )}
      </div>

      {/* Provably Fair Watermark */}
      <div className="absolute bottom-2 right-3 z-10 text-[9px] font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1 pointer-events-none">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60" />
        <span>SHA-256 Provably Fair</span>
      </div>
    </div>
  );
};
