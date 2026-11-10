import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import SearchInput from './components/SearchInput';
import ImageGrid from './components/ImageGrid';
import Loader from './components/Loader';
import ImageModal from './components/ImageModal';
import ThemeToggle from './components/ThemeToggle';
import { fetchAllImageIds, fetchSearchResults } from './services/api';
import { ImageSearchResult } from './types';

const IMAGES_PER_PAGE = 20;

const shuffle = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const App: React.FC = () => {
  const [originalImageResults, setOriginalImageResults] = useState<ImageSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [isShuffled, setIsShuffled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('isShuffled') === 'true';
    } catch (e) {
      console.error('Failed to read shuffle state from localStorage', e);
      return false;
    }
  });

  const [allImageIds, setAllImageIds] = useState<string[]>([]);
  const [shuffledAllImageIds, setShuffledAllImageIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('isShuffled', String(isShuffled));
    } catch (e) {
      console.error('Failed to save shuffle state to localStorage', e);
    }
  }, [isShuffled]);

  useEffect(() => {
    setShuffledAllImageIds(shuffle(allImageIds));
  }, [allImageIds]);

  const displayedImages = originalImageResults;

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#image-')) {
        setSelectedImageId(hash.substring('#image-'.length));
      } else {
        setSelectedImageId(null);
      }
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const handleImageSelect = (imageId: string, replace = false) => {
    if (replace) {
      window.history.replaceState(null, '', `#image-${imageId}`);
      setSelectedImageId(imageId);
    } else {
      window.location.hash = `image-${imageId}`;
    }
  };

  const handleCloseModal = () => {
    window.location.hash = '';
  };

  const observer = useRef<IntersectionObserver | null>(null);
  const loaderRef = useCallback(node => {
    if (isLoading || isLoadingMore || hasSearched) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    });

    if (node) observer.current.observe(node);
  }, [isLoading, isLoadingMore, hasMore, hasSearched]);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setError(null);
        setIsLoading(true);
        const ids = await fetchAllImageIds();
        setAllImageIds(ids);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : '이미지를 불러오는 데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    };
    loadInitialData();
  }, []);

  // This effect sets up the initial view or resets it when shuffle/search state changes.
  useEffect(() => {
    if (hasSearched) return; // Only for initial view

    const sourceIds = isShuffled ? shuffledAllImageIds : allImageIds;
    if (sourceIds.length === 0 && allImageIds.length > 0) return; // Wait for shuffle to complete

    setOriginalImageResults(sourceIds.slice(0, IMAGES_PER_PAGE).map(id => ({ image_id: id, score: 0 })));
    setPage(1);
    setHasMore(sourceIds.length > IMAGES_PER_PAGE);

  }, [isShuffled, hasSearched, allImageIds, shuffledAllImageIds]);

  useEffect(() => {
    if (page === 1 || hasSearched) return;

    const loadMore = async () => {
      setIsLoadingMore(true);
      await new Promise(res => setTimeout(res, 300));

      const sourceIds = isShuffled ? shuffledAllImageIds : allImageIds;

      const newImages = sourceIds
        .slice((page - 1) * IMAGES_PER_PAGE, page * IMAGES_PER_PAGE)
        .map(id => ({ image_id: id, score: 0 }));

      setOriginalImageResults(prev => [...prev, ...newImages]);
      setHasMore(page * IMAGES_PER_PAGE < sourceIds.length);
      setIsLoadingMore(false);
    }
    loadMore();
  }, [page, allImageIds, hasSearched, isShuffled, shuffledAllImageIds]);


  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setHasSearched(false);
      // The useEffect listening to `hasSearched` will reset the view to the initial state.
      return;
    }

    setIsLoading(true);
    setError(null);
    setOriginalImageResults([]);
    setHasSearched(true);
    setHasMore(false);

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    try {
      setOriginalImageResults(await fetchSearchResults(query));
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    if (isLoading) return;
    window.location.hash = '';
    setSearchQuery('');
    performSearch('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [isLoading, performSearch]);

  const renderContent = () => {
    if (isLoading && originalImageResults.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400 mt-12 h-96">
          <img className="w-auto h-48 object-cover rounded-lg" src="https://i.pinimg.com/736x/47/7e/d6/477ed6f6b6ea6cee5a76f3ed2dae4fa4.jpg" alt="기다려주세요 짤" />
          <p className="text-gray-500 dark:text-gray-400 mt-4">
            {hasSearched ? 'AI가 열심히 무도 정주행 중...' : '무도짤 수집 중...'}
          </p>
        </div>
      );
    }
    if (error) {
      return <p className="text-center text-red-500 mt-12">오류가 발생했습니다: {error}</p>;
    }
    if (hasSearched && !isLoading && originalImageResults.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400 mt-12">
          <img className="w-auto h-48 object-cover rounded-lg" src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR-B7k1XckQ2JkXaE4kBw0NpH-dbJbLT85SMg&s" alt="결과 없음" />
          <p className="text-md mt-4">검색 결과가 없습니다.</p>
        </div>
      )
    }
    if (displayedImages.length > 0) {
      return <ImageGrid images={displayedImages} onImageSelect={handleImageSelect} />;
    }

    if (!isLoading) {
      return (
        <div className="flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400 mt-12 h-96">
          <img className="w-auto h-48 object-cover rounded-lg" src="https://i.pinimg.com/736x/47/7e/d6/477ed6f6b6ea6cee5a76f3ed2dae4fa4.jpg" alt="기다려주세요 짤" />
          <p className="text-md mt-4">무도짤 수집 중...</p>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      <div className="min-h-screen font-sans p-4 sm:p-6 lg:p-8 pb-32">
        <div className="container mx-auto max-w-7xl">
          <header className="flex justify-between items-center">
            <img onClick={reset} className="w-24 h-24 object-cover rounded-lg cursor-pointer" src="/favicon.png" alt="무야호 짤" />
            <div className="flex items-center gap-2">
              {!hasSearched && <button
                onClick={() => setIsShuffled(prev => !prev)}
                className={`h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-full transition-colors ${isShuffled ? 'bg-indigo-500 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/10'}`}
                aria-label="Toggle image shuffle"
                aria-pressed={isShuffled}
                title={isShuffled ? '결과 순서대로 보기' : '결과 섞어보기'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 3h5v5M4 20L20 4M21 16v5h-5M4 4l5 5" />
                </svg>
              </button>}
              <ThemeToggle />
            </div>
          </header>
          <main>
            {renderContent()}
            <div ref={loaderRef} className="h-24 flex items-center justify-center">
              {isLoadingMore && <Loader />}
            </div>
          </main>
        </div>
      </div>

      {/* Gradual Blur Backdrop for Search Input */}
      <div
        className="fixed bottom-0 left-0 right-0 h-40 z-30 pointer-events-none backdrop-blur-2xl bg-gradient-to-t from-white/50 via-white/20 to-transparent dark:from-black/50 dark:via-black/20 dark:to-transparent"
        style={{
          maskImage: 'linear-gradient(to top, black, transparent)',
          WebkitMaskImage: 'linear-gradient(to top, black, transparent)'
        }}
      />

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-lg z-40">
        <div className="relative flex items-center gap-2 rounded-full bg-white/70 dark:bg-black/50 shadow-lg ring-1 ring-black/5 backdrop-blur-lg pr-2">
          <SearchInput
            query={searchQuery}
            onQueryChange={setSearchQuery}
            onSearch={performSearch}
            isLoading={isLoading}
          />
        </div>
      </div>

      <AnimatePresence>
        {selectedImageId && (
          <ImageModal
            imageId={selectedImageId}
            onClose={handleCloseModal}
            onNext={() => {
              const currentIndex = displayedImages.findIndex(img => img.image_id === selectedImageId);
              if (currentIndex !== -1 && currentIndex < displayedImages.length - 1) {
                handleImageSelect(displayedImages[currentIndex + 1].image_id, true);
              }
            }}
            onPrev={() => {
              const currentIndex = displayedImages.findIndex(img => img.image_id === selectedImageId);
              if (currentIndex > 0) {
                handleImageSelect(displayedImages[currentIndex - 1].image_id, true);
              }
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default App;
