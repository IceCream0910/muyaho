import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';

const imageCache = new Map<string, string>();

async function getCachedImageUrl(url: string): Promise<string> {
  if (imageCache.has(url)) {
    return imageCache.get(url)!;
  }
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch image: ${response.statusText}`);
      return url;
    }
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    imageCache.set(url, blobUrl);
    return blobUrl;
  } catch (error) {
    console.error(`Failed to fetch and cache image ${url}:`, error);
    return url;
  }
}

interface ImageCardProps {
  imageId: string;
  onSelect: (imageId: string) => void;
  index: number;
}

const ImageCard: React.FC<ImageCardProps> = ({ imageId, onSelect, index }) => {
  const imageUrl = `https://muyaho-api.yuntae.in/img?id=${imageId}`;
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadImage = async () => {
      const urlToDisplay = await getCachedImageUrl(imageUrl);
      if (isMounted) {
        setDisplayUrl(urlToDisplay);
      }
    };
    loadImage();
    return () => {
      isMounted = false;
    };
  }, [imageUrl]);

  const rotation = useMemo(() => (index === 0 ? 0 : Math.random() * 8 - 4), [index]); // -4 to 4도로 기울이기

  return (
    <div
      className="image-card-container w-full cursor-pointer group"
      onClick={() => onSelect(imageId)}
      role="button"
      tabIndex={0}
      onKeyPress={(e) => e.key === 'Enter' && onSelect(imageId)}
      aria-label={`View image ${imageId}`}
    >
      <motion.div
        className={`relative w-full aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden shadow-md ${!isLoaded || !displayUrl ? 'animate-pulse' : ''}`}
        style={{ rotate: rotation }}
        whileHover={{ scale: 1.05, rotate: 0, zIndex: 10, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      >
        {displayUrl && (
          <motion.img
            layoutId={`card-image-${imageId}`}
            src={displayUrl}
            alt={`Meme ${imageId}`}
            className="object-cover w-full h-full"
            loading="lazy"
            onLoad={() => setIsLoaded(true)}
            initial={{ opacity: 0 }}
            animate={{ opacity: isLoaded ? 1 : 0 }}
            transition={{ duration: 0.5 }}
          />
        )}
      </motion.div>
    </div>
  );
};

export default ImageCard;