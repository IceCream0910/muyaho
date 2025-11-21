import { KeywordApiResponse, ImageSearchResult } from '../types';

const API_BASE_URL = 'https://muyaho-api.yuntae.in';

export const fetchAllImageIds = async (): Promise<string[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/all`);
    if (!response.ok) {
      console.error(`전체 이미지 ID 로드 실패 (HTTP ${response.status})`);
      throw new Error('전체 이미지 목록을 불러오는 중 서버에서 오류가 발생했습니다.');
    }
    const data = await response.json();
    if (Array.isArray(data) && data.every(item => typeof item === 'string')) {
      return data;
    }
    throw new Error('API 응답 형식이 올바르지 않습니다.');
  } catch (error) {
    console.error('전체 이미지 API 네트워크 오류:', error);
    if (error instanceof Error && error.message.toLowerCase().includes('failed to fetch')) {
      throw new Error('서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.');
    }
    throw error;
  }
};

export const fetchKeywords = async (query: string): Promise<KeywordApiResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/keywords`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      console.error(`키워드 추출 실패 (HTTP ${response.status})`);
      throw new Error(`키워드 추출 중 서버에서 오류가 발생했습니다.`);
    }

    return response.json();
  } catch (error) {
    console.error('키워드 API 네트워크 오류:', error);
    if (error instanceof Error && error.message.toLowerCase().includes('failed to fetch')) {
      throw new Error('서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.');
    }
    throw error;
  }
};

export const fetchImagesByKeyword = async (keyword: string): Promise<ImageSearchResult[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/direct_search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: keyword }),
    });

    if (response.status === 404) {
      return [];
    }

    if (!response.ok) {
      console.error(`'${keyword}' 키워드 이미지 검색 실패 (HTTP ${response.status})`);
      throw new Error('이미지 검색 중 서버에서 오류가 발생했습니다.');
    }

    return response.json();
  } catch (error) {
    console.error(`'${keyword}' 키워드 검색 중 네트워크 오류:`, error);
    if (error instanceof Error && error.message.toLowerCase().includes('failed to fetch')) {
      throw new Error('서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.');
    }
    throw error;
  }
};
