import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchInputProps {
  query: string;
  onQueryChange: (query: string) => void;
  onSearch: (query: string) => void;
  isLoading: boolean;
  isEnhancedSearch: boolean;
  onEnhancedSearchChange: (isEnhanced: boolean) => void;
}

const placeholders = [
  "어떤 짤을 찾고 계신가요?",
  "인사, 미안, 퇴근, 피곤",
];

const SearchInput: React.FC<SearchInputProps> = ({
  query,
  onQueryChange,
  onSearch,
  isLoading,
  isEnhancedSearch,
  onEnhancedSearchChange
}) => {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setPlaceholderIndex((prevIndex) => (prevIndex + 1) % placeholders.length);
    }, 4000);

    return () => clearInterval(intervalId);
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isLoading) {
      onSearch(query.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full flex-grow">
      <div className="relative flex items-center">
        <AnimatePresence>
          {showTooltip && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-full left-1 right-0 mb-4 p-3 bg-gray-900/90 dark:bg-white/90 text-white dark:text-gray-900 text-sm rounded-2xl shadow-xl backdrop-blur-xl z-50 pointer-events-none"
            >
              <p>
                <span className="text-yellow-400 dark:text-yellow-600 font-bold mr-1">✨ AI 모드:</span>
                맥락을 파악해 더 많은 짤을 찾아줄게요.
              </p>
              <div className="absolute -bottom-1 right-[64px] w-3 h-3 bg-gray-900/90 dark:bg-white/90 rotate-45"></div>
            </motion.div>
          )}
        </AnimatePresence>

        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder=""
          disabled={isLoading}
          className="w-full pl-5 pr-24 py-3 text-base bg-transparent text-gray-900 dark:text-white focus:outline-none relative z-10"
        />

        {!query && (
          <div className="absolute left-5 top-1/2 -translate-y-1/2 h-6 flex items-center pointer-events-none text-gray-500 dark:text-gray-400 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.span
                key={placeholders[placeholderIndex]}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.5, type: 'spring', stiffness: 100 }}
                className="block whitespace-nowrap"
              >
                {placeholders[placeholderIndex]}
              </motion.span>
            </AnimatePresence>
          </div>
        )}

        <div className="absolute top-1/2 -translate-y-1/2 right-2 flex items-center gap-1 z-20">
          <button
            type="button"
            onClick={() => onEnhancedSearchChange(!isEnhancedSearch)}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            className={`flex items-center justify-center h-8 w-8 rounded-full transition-colors ${isEnhancedSearch
              ? 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30'
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 ml-1.5">
              <path fillRule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813a3.75 3.75 0 002.576-2.576l.813-2.846A.75.75 0 019 4.5z" clipRule="evenodd" />
            </svg>
          </button>

          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center justify-center h-8 w-8 text-gray-600 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/10 transition-colors rounded-full disabled:opacity-50"
            aria-label="Search"
          >
            {isLoading ? (
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </form>
  );
};

export default SearchInput;