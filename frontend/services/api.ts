/// <reference types="vite/client" />

import { ImageSearchResult } from '../types';

const API_BASE_URL = 'https://muyaho-api.yuntae.in';
const CATALOG_BASE_URL = import.meta.env.DEV ? '/api/catalog' : API_BASE_URL;
const SEARCH_URL = import.meta.env.DEV ? '/api/semantic_search' : `${API_BASE_URL}/semantic_search`;

export const getImageUrl = (imageId: string) => `${CATALOG_BASE_URL}/img?id=${encodeURIComponent(imageId)}`;

export const fetchSearchResults = async (query: string): Promise<ImageSearchResult[]> => {
  const response = await fetch(SEARCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit: 20 }),
  });

  if (!response.ok) {
    throw new Error('이미지 검색 중 서버에서 오류가 발생했습니다.');
  }

  return response.json();
};

export const fetchAllImageIds = async (): Promise<string[]> => {
  const response = await fetch(`${CATALOG_BASE_URL}/all`);
  if (!response.ok) {
    throw new Error('전체 이미지 목록을 불러오는 중 서버에서 오류가 발생했습니다.');
  }

  const data = await response.json();
  if (!Array.isArray(data) || !data.every(item => typeof item === 'string')) {
    throw new Error('API 응답 형식이 올바르지 않습니다.');
  }
  return data;
};
