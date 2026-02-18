/**
 * AttachmentPreview — shows attached media before sending
 */
import { X, FileText, Mic, Image, PenTool } from 'lucide-react';
import type { MediaAttachment } from '@/types';

interface Props {
  attachments: MediaAttachment[];
  onRemove: (id: string) => void;
}

const typeIcon = {
  image: Image,
  audio: Mic,
  file: FileText,
  drawing: PenTool,
  text: FileText,
};

const typeColor = {
  image: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  audio: 'text-green-400 bg-green-500/10 border-green-500/30',
  file: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  drawing: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  text: 'text-surface-400 bg-surface-500/10 border-surface-500/30',
};

export function AttachmentPreview({ attachments, onRemove }: Props) {
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-4 py-2 border-t border-surface-700/50">
      {attachments.map(att => {
        const Icon = typeIcon[att.type] || FileText;
        const color = typeColor[att.type] || typeColor.text;
        return (
          <div key={att.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border ${color} max-w-[180px] group relative`}>
            {att.type === 'image' && att.thumbnail ? (
              <img src={att.thumbnail} alt={att.name} className="w-8 h-8 rounded object-cover flex-shrink-0" />
            ) : (
              <Icon className="w-4 h-4 flex-shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-xs font-medium truncate text-white">{att.name}</p>
              {att.type === 'audio' && att.transcript && (
                <p className="text-xs opacity-70 truncate">{att.transcript}</p>
              )}
              {att.size && (
                <p className="text-xs opacity-50">{(att.size / 1024).toFixed(1)}KB</p>
              )}
            </div>
            <button
              onClick={() => onRemove(att.id)}
              className="ml-1 p-0.5 rounded hover:bg-white/10 flex-shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
