<img src="https://i.imgur.com/MvRov0e.png" width="150" height="120" style="margin-bottom: 10px;" />

### 세상의 모든 무도짤, 여기서 검색.

"그 짤 어디 갔더라..."
더 이상 갤러리에서 짤 찾느라 고생할 필요가 없습니다!
원하는 키워드를 입력하면 AI가 찰떡같은 무도짤을 찾아줄게요.

## 🛠 Tech Stack

### Backend
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat-square&logo=openai&logoColor=white)
![Gemini](https://img.shields.io/badge/Google_Gemini-8E75B2?style=flat-square&logo=google&logoColor=white)

- **이미지 분석**: Gemini VLM을 활용하여 이미지 속 텍스트를 OCR하고 상황, 표정, 분위기 등 시각적 특징을 텍스트로 추출합니다.
- **이미지 임베딩**: 이미지 정보 텍스트를 임베딩하여 OpenAI Vector DB에 저장합니다.
- **자연어 검색**: Vector DB 기반 Semantic Search와 텍스트 기반 검색 결과를 종합해 사용자의 질의에 어울리는 짤을 찾아줍니다.

### Frontend
![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)
![Framer Motion](https://img.shields.io/badge/Framer_Motion-0055FF?style=flat-square&logo=framer&logoColor=white)

## 🚀 Getting Started

### Backend

```bash
cd backend
pip install -r requirements.txt

export OPENAI_API_KEY="your_key"
export GEMINI_API_KEY="your_key"

python api.py
```

### Frontend

```bash
cd frontend
npm install

npm run dev
```

## 📝 License

This project is licensed under the MIT License.
