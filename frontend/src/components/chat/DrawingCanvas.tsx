/**
 * DrawingCanvas — whiteboard for handwritten math/diagrams
 */
import { useRef, useEffect, useState, useCallback } from 'react';
import { Eraser, Pen, Trash2, Check, X } from 'lucide-react';

interface Props {
  onSubmit: (dataUrl: string) => void;
  onClose: () => void;
}

type Tool = 'pen' | 'eraser';

export function DrawingCanvas({ onSubmit, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#ffffff');
  const [lineWidth, setLineWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    setIsEmpty(false);
    lastPos.current = getPos(e, canvas);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = tool === 'eraser' ? '#0f172a' : color;
    ctx.lineWidth = tool === 'eraser' ? lineWidth * 4 : lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();
    lastPos.current = pos;
  };

  const endDraw = () => setIsDrawing(false);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
  };

  const handleSubmit = () => {
    const canvas = canvasRef.current;
    if (!canvas || isEmpty) return;
    onSubmit(canvas.toDataURL('image/png'));
  };

  const colors = ['#ffffff', '#38bdf8', '#fb7185', '#4ade80', '#facc15', '#c084fc', '#f97316'];
  const widths = [2, 4, 6, 10];

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-surface-900 border border-surface-700 rounded-2xl w-full max-w-2xl shadow-2xl">
        {/* Toolbar */}
        <div className="flex items-center gap-3 p-3 border-b border-surface-700 flex-wrap">
          <div className="flex gap-1">
            <button onClick={() => setTool('pen')}
              className={`p-2 rounded-lg transition-colors ${tool === 'pen' ? 'bg-primary-500 text-white' : 'hover:bg-surface-800 text-surface-400'}`}>
              <Pen className="w-4 h-4" />
            </button>
            <button onClick={() => setTool('eraser')}
              className={`p-2 rounded-lg transition-colors ${tool === 'eraser' ? 'bg-primary-500 text-white' : 'hover:bg-surface-800 text-surface-400'}`}>
              <Eraser className="w-4 h-4" />
            </button>
          </div>

          {/* Colors */}
          <div className="flex gap-1">
            {colors.map(c => (
              <button key={c} onClick={() => { setColor(c); setTool('pen'); }}
                className={`w-6 h-6 rounded-full border-2 transition-all ${color === c && tool === 'pen' ? 'border-white scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>

          {/* Line width */}
          <div className="flex gap-1 items-center">
            {widths.map(w => (
              <button key={w} onClick={() => setLineWidth(w)}
                className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${lineWidth === w ? 'bg-primary-500/20 text-primary-400' : 'hover:bg-surface-800 text-surface-500'}`}>
                <div className="rounded-full bg-current" style={{ width: w + 2, height: w + 2 }} />
              </button>
            ))}
          </div>

          <button onClick={clear} className="ml-auto p-2 hover:bg-red-500/10 rounded-lg text-red-400 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Canvas */}
        <div className="p-3 bg-surface-950 rounded-b-none">
          <canvas
            ref={canvasRef}
            width={680}
            height={380}
            className="w-full rounded-lg cursor-crosshair touch-none"
            style={{ background: '#0f172a' }}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={endDraw}
          />
          <p className="text-xs text-surface-600 text-center mt-2">
            Draw your problem, diagram, or handwritten notes
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-3 border-t border-surface-700">
          <button onClick={onClose} className="flex-1 btn-secondary py-2 rounded-lg flex items-center justify-center gap-2">
            <X className="w-4 h-4" /> Cancel
          </button>
          <button onClick={handleSubmit} disabled={isEmpty}
            className="flex-1 btn-primary py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            <Check className="w-4 h-4" /> Send Drawing
          </button>
        </div>
      </div>
    </div>
  );
}
