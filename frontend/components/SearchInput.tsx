import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchInputProps {
  query: string;
  onQueryChange: (query: string) => void;
  onSearch: (query: string) => void;
  isLoading: boolean;
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
}) => {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

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
        <input
          type="text"
          aria-label="짤 검색어"
          value={query}
          maxLength={500}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder=""
          disabled={isLoading}
          className="w-full pl-5 pr-12 py-3 text-base bg-transparent text-gray-900 dark:text-white focus:outline-none relative z-10"
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
