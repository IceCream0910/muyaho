
import React from 'react';
import ImageCard from './ImageCard';
import { ImageSearchResult } from '../types';

interface ImageGridProps {
  images: ImageSearchResult[];
  onImageSelect: (imageId: string) => void;
}

const ImageGrid: React.FC<ImageGridProps> = ({ images, onImageSelect }) => {
  if (images.length === 0) {
    return null;
  }

  return (
    <div className="w-full grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-12">
      {images.map((image, index) => (
        <ImageCard 
          key={image.image_id} 
          imageId={image.image_id}
          onSelect={onImageSelect} 
          index={index}
        />
      ))}
    </div>
  );
};

export default ImageGrid;