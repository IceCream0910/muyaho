
export interface KeywordApiResponse {
  related_keywords: string[];
  rewritten_query: string;
}

export interface ImageSearchResult {
  image_id: string;
  score: number;
}
