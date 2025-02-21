from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn
from dotenv import load_dotenv
import os

# Import LangChain and Milvus dependencies
from langchain_openai import OpenAIEmbeddings, OpenAI
from langchain.memory import VectorStoreRetrieverMemory
from langchain.chains import ConversationChain
from langchain.prompts import PromptTemplate
from langchain_milvus.vectorstores import Milvus

load_dotenv()

# Initialize language model and embeddings
llm = OpenAI()
embeddings = OpenAIEmbeddings()

# Define Milvus vector database parameters
index_params = {
    "index_type": "FLAT",
    "metric_type": "L2",
    "params": {},
}

# In main.py, update the Milvus connection URI:
milvus_uri = os.getenv("MILVUS_URI", "http://milvus:19530")
vectordb = Milvus(
    embeddings,
    connection_args={"uri": milvus_uri},
    index_params=index_params,
    auto_id=True,
)

retriever = vectordb.as_retriever(search_kwargs=dict(k=1))
memory = VectorStoreRetrieverMemory(retriever=retriever)

# Expanded mock user data for a cardiovascular patient
about_me = [
    {"input": "My name is Bob.", "output": "Got it!"},
    {"input": "I am 55 years old.", "output": "Got it!"},
    {"input": "I have been diagnosed with hypertension.", "output": "Got it!"},
    {"input": "I also have high cholesterol.", "output": "Got it!"},
    {"input": "I underwent angioplasty last year.", "output": "Got it!"},
    {"input": "I follow a low-sodium, heart-healthy diet.", "output": "Got it!"},
    {"input": "I exercise moderately on a regular basis.", "output": "Got it!"},
    {"input": "I live in San Francisco.", "output": "Got it!"},
    {"input": "I currently take medication for blood pressure and cholesterol management.", "output": "Got it!"},
]

for example in about_me:
    memory.save_context({"input": example["input"]}, {"output": example["output"]})

# Define the prompt template with a medical disclaimer and guidance
prompt_template = """
Disclaimer: I am not a doctor, and the information provided in this conversation is for informational purposes only. My responses do not substitute for professional medical advice, diagnosis, or treatment. If you are experiencing a medical emergency or severe symptoms, please seek immediate help from a qualified healthcare professional or call emergency services.

The following is a conversation with a medical chatbot. The chatbot is designed to provide detailed and specific health-related information. However, if the user's question involves severe or urgent medical symptoms, the chatbot will advise consulting a professional.

Relevant pieces of previous conversation: {history}
User: {input}
Chatbot:
"""

prompt = PromptTemplate(input_variables=["history", "input"], template=prompt_template)

# Create the conversation chain with memory
conversation_with_memory = ConversationChain(
    llm=llm, prompt=prompt, memory=memory, verbose=True
)

# Fallback mechanism functions
def is_response_uncertain(response):
    uncertainty_indicators = ["i'm not sure", "uncertain", "i don't have enough information"]
    return any(indicator in response.lower() for indicator in uncertainty_indicators)

def is_sensitive_query(user_input):
    sensitive_keywords = ["suicide", "self-harm", "harm myself", "i feel hopeless"]
    return any(word in user_input.lower() for word in sensitive_keywords)

def fallback_response(user_input, generated_response):
    if is_sensitive_query(user_input):
        return ("I'm sorry you're experiencing these feelings. It sounds like you could use professional help. "
                "Please consider reaching out to a trusted healthcare provider or crisis intervention service immediately.")
    elif is_response_uncertain(generated_response):
        return ("I'm not completely sure about that. It would be best to consult a healthcare professional for personalized advice.")
    else:
        return generated_response

def check_for_emergency(input_text):
    emergency_keywords = [
        "emergency",
        "chest pain",
        "severe",
        "unconscious",
        "difficulty breathing",
        "shortness of breath",
    ]
    return any(keyword in input_text.lower() for keyword in emergency_keywords)

# Define FastAPI models and app
app = FastAPI()

class ChatRequest(BaseModel):
    user_input: str

class ChatResponse(BaseModel):
    response: str

@app.post("/chat", response_model=ChatResponse)
def chat_endpoint(chat_request: ChatRequest):
    user_input = chat_request.user_input
    print("Received input:", user_input)
    if check_for_emergency(user_input):
        emergency_msg = (
            "It sounds like you may be experiencing an emergency. Please seek immediate medical assistance "
            "or call your local emergency services. Additionally, consult your local medical institutions as soon as possible."
        )
        return ChatResponse(response=emergency_msg)
    
    try:
        generated_response = conversation_with_memory.predict(input=user_input)
        print("Generated response:", generated_response)
    except Exception as e:
        print("Error during prediction:", e)
        return ChatResponse(response="An error occurred processing your request.")
    
    final_response = fallback_response(user_input, generated_response)
    return ChatResponse(response=final_response)


@app.get("/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)


