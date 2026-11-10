import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getImageUrl } from '../services/api';

interface ImageModalProps {
  imageId: string;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
}

const variants = {
  enter: (direction: number) => {
    return {
      x: direction > 0 ? 1000 : -1000,
      opacity: 0
    };
  },
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1
  },
  exit: (direction: number) => {
    return {
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0
    };
  }
};

const ImageModal: React.FC<ImageModalProps> = ({ imageId, onClose, onNext, onPrev }) => {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success'>('idle');
  const [[page, direction], setPage] = useState([0, 0]);
  const imageUrl = getImageUrl(imageId);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && onNext) onNext();
      if (e.key === 'ArrowLeft' && onPrev) onPrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto';
    };
  }, [onClose, onNext, onPrev]);

  const handleCopyImage = async () => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');
      ctx.drawImage(img, 0, 0);

      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Failed to create blob from canvas');

      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blob
        })
      ]);

      setCopyStatus('success');
    } catch (err) {
      console.error('Failed to copy image: ', err);
      try {
        await navigator.clipboard.writeText(imageUrl);
        setCopyStatus('success');
        alert('이미지 복사에 실패했습니다. 대신 이미지 URL을 복사했어요.');
      } catch (copyErr) {
        console.error('Failed to copy URL as fallback:', copyErr);
        alert('이미지 및 URL 복사에 모두 실패했습니다.');
      }
    } finally {
      setTimeout(() => setCopyStatus('idle'), 2000);
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `muyaho-${imageId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const paginate = (newDirection: number) => {
    setPage([page + newDirection, newDirection]);
    if (newDirection > 0 && onNext) onNext();
    if (newDirection < 0 && onPrev) onPrev();
  };

  const isMobile = typeof window !== 'undefined' && window.matchMedia("(pointer: coarse)").matches;

  return (
    <motion.div
      className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className="relative w-full max-w-5xl h-full flex flex-col items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {onPrev && (
          <button
            onClick={(e) => { e.stopPropagation(); paginate(-1); }}
            className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-20 p-2 text-white/50 hover:text-white transition-colors bg-black/20 hover:bg-black/40 rounded-full"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 md:w-10 md:h-10">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
        )}
        {onNext && (
          <button
            onClick={(e) => { e.stopPropagation(); paginate(1); }}
            className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-20 p-2 text-white/50 hover:text-white transition-colors bg-black/20 hover:bg-black/40 rounded-full"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 md:w-10 md:h-10">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        )}

        <div className="relative w-full flex-grow flex items-center justify-center overflow-hidden">
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.img
              key={imageId}
              src={imageUrl}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 }
              }}
              drag={isMobile ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={1}
              onDragEnd={(e, { offset, velocity }) => {
                const swipe = swipePower(offset.x, velocity.x);
                if (swipe < -swipeConfidenceThreshold && onNext) {
                  paginate(1);
                } else if (swipe > swipeConfidenceThreshold && onPrev) {
                  paginate(-1);
                }
              }}
              alt={`Meme ${imageId}`}
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl absolute"
            />
          </AnimatePresence>
        </div>

        <motion.div
          className="flex-shrink-0 mt-6 flex justify-center gap-4 z-20"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          <button
            onClick={handleDownload}
            className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-full hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 shadow-lg"
          >
            다운로드
          </button>
          <button
            onClick={handleCopyImage}
            className={`px-6 py-3 font-semibold rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 shadow-lg ${copyStatus === 'success'
              ? 'bg-green-600 text-white focus:ring-green-500'
              : 'bg-white text-gray-900 hover:bg-gray-100 focus:ring-gray-400'
              }`}
          >
            {copyStatus === 'success' ? '복사 완료!' : '이미지 복사'}
          </button>
        </motion.div>
      </div>
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors z-50 p-2"
        aria-label="Close"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </motion.div>
  );
};

const swipeConfidenceThreshold = 10000;
const swipePower = (offset: number, velocity: number) => {
  return Math.abs(offset) * velocity;
};

export default ImageModal;
