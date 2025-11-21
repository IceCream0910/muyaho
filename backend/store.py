import os
import json
import uuid
from pathlib import Path
from google import genai
from google.genai import types
from openai import OpenAI


IMAGES_DIR = "./images"
STATE_FILE = "./processing_state.json"


def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {"processed_images": {}, "vector_store_id": None}


def save_state(state):
    with open(STATE_FILE, 'w', encoding='utf-8') as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


def get_or_create_vector_store(openai_client, state):
    if state["vector_store_id"]:
        return state["vector_store_id"]
    
    vector_store = openai_client.vector_stores.create(
        name="Meme Images OCR"
    )
    state["vector_store_id"] = vector_store.id
    save_state(state)
    return vector_store.id


def ocr_image(gemini_client, image_path):
    with open(image_path, 'rb') as f:
        image_data = f.read()
    
    ext = Path(image_path).suffix.lower()
    mime_type_map = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.heic': 'image/heic',
        '.heif': 'image/heif'
    }
    
    mime_type = mime_type_map.get(ext, 'image/jpeg')
    
    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part.from_bytes(
                    data=image_data, 
                    mime_type=mime_type
                ),
                types.Part.from_text(
                    text="""이 meme 이미지를 분석해서 다음 정보를 제공해줘:
1. 이미지에 포함된 모든 자막 텍스트 (방송사/프로그램명 제외)
2. 인물이 포함된 경우 감정이나 상황
3. 이미지의 전체적인 맥락이나 의미

각 항목을 명확히 구분하지 말고 자연스럽게 하나의 설명으로 작성해줘. 완결된 문장이 아닌 키워드 형태여도 괜찮아.
부가 설명 없이 결과 텍스트만 응답해."""
                ),
            ],
        ),
    ]
    
    response = gemini_client.models.generate_content(
        model="gemini-flash-lite-latest",
        contents=contents,
    )
    
    return response.text


def upload_to_vector_store(openai_client, vector_store_id, image_id, ocr_text, original_filename):
    temp_content = f"{ocr_text}"
    temp_file_path = f"{image_id}.txt"
    
    with open(temp_file_path, 'w', encoding='utf-8') as f:
        f.write(temp_content)
    
    with open(temp_file_path, 'rb') as f:
        file = openai_client.files.create(
            file=f,
            purpose='assistants'
        )
    
    vector_file = openai_client.vector_stores.files.create(
        vector_store_id=vector_store_id,
        file_id=file.id,
        attributes={
            "image_id": image_id,
            "original_filename": original_filename
        }
    )
    
    os.remove(temp_file_path)
    return file.id, vector_file.id


def process_images():
    gemini_client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
    openai_client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    
    state = load_state()
    vector_store_id = get_or_create_vector_store(openai_client, state)
    
    os.makedirs(IMAGES_DIR, exist_ok=True)
    
    image_files = [f for f in os.listdir(IMAGES_DIR) 
                   if f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp'))]
    
    for image_file in image_files:
        image_path = os.path.join(IMAGES_DIR, image_file)
        
        if image_file in state["processed_images"]:
            print(f"Skipping already processed: {image_file}")
            continue
        
        print(f"Processing: {image_file}")
        
        image_id = str(uuid.uuid4())
        
        try:
            ocr_text = ocr_image(gemini_client, image_path)
            print(f"OCR Result: {ocr_text[:100]}...")
            
            file_id, vector_file_id = upload_to_vector_store(
                openai_client, vector_store_id, image_id, ocr_text, image_file
            )
            
            new_filename = f"{image_id}{Path(image_file).suffix}"
            new_path = os.path.join(IMAGES_DIR, new_filename)
            
            if image_file != new_filename:
                os.rename(image_path, new_path)
            
            state["processed_images"][new_filename] = {
                "original_name": image_file,
                "image_id": image_id,
                "file_id": file_id,
                "vector_file_id": vector_file_id,
                "ocr_text": ocr_text
            }
            
            save_state(state)
            print(f"Completed: {new_filename}\n")
            
        except Exception as e:
            print(f"Error processing {image_file}: {e}\n")
            continue
    
    print(f"\nProcessing complete!")
    print(f"Vector Store ID: {vector_store_id}")
    print(f"Total processed images: {len(state['processed_images'])}")


if __name__ == "__main__":
    process_images()