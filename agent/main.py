from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
from dotenv import load_dotenv
from typing import Optional, Dict
import PyPDF2
import os
import json

# Use ephemeral memory (in‑process)
from langchain.memory import ConversationBufferMemory
from langchain.chains import ConversationChain
from langchain.prompts import PromptTemplate
from langchain_openai import OpenAI

# Load environment variables
load_dotenv()

# Initialize the language model
llm = OpenAI()

# Create ephemeral memory – this will only persist while the server is running.
memory = ConversationBufferMemory(return_messages=True)

# Global variable to store the last inserted profile.
current_profile: Optional[Dict] = None


# Function to load Crestor medication information from a PDF file.
def load_crestor_info(pdf_path: str) -> str:
    try:
        with open(pdf_path, "rb") as file:
            reader = PyPDF2.PdfReader(file)
            text = ""
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
            return text
    except Exception as e:
        print(f"Error reading PDF: {e}")
        return ""


# Load the Crestor info from the PDF (adjust the path as needed)
crestor_info = load_crestor_info("crestor_eng.pdf")
# Limit the length to the first 5000 characters
crestor_info = crestor_info[:5000]

# Define the prompt template.
prompt_template = """
Disclaimer: I am not a doctor, and the information provided is for informational purposes only.
My responses do not substitute for professional medical advice, diagnosis, or treatment.
If you are experiencing an emergency or severe symptoms, please seek immediate help.

Relevant conversation so far: {history}
User: {input}
Chatbot:
"""
prompt = PromptTemplate(input_variables=["history", "input"], template=prompt_template)

# Create the global conversation chain using ephemeral memory.
conversation_with_memory = ConversationChain(
    llm=llm, prompt=prompt, memory=memory, verbose=True
)


# -------------------------------
# Helper Functions
# -------------------------------
def insert_profile_into_memory(profile: dict):
    """Clear previous conversation memory if the profile has changed, then insert the new profile data."""
    global current_profile
    if current_profile == profile:
        print("Profile unchanged. Not updating memory.")
        return

    current_profile = profile
    memory.clear()

    name = profile.get("first_name", "Unknown")
    age = profile.get("age", "unknown")
    diagnosis = profile.get("diagnosis", "no diagnosis")
    medicine = profile.get("medicine", "no medicine")
    activities_list = profile.get("recommended_activities", [])
    activities_str = ", ".join(activities_list) if activities_list else "none"

    profile_text = (
        f"My name is {name}. I am {age} years old. I have been diagnosed with {diagnosis}. "
        f"I currently take {medicine}. My recommended activities are {activities_str}."
    )
    # If the user's medicine includes "crestor", append additional info from the PDF with citation.
    if "crestor" in medicine.lower() and crestor_info:
        profile_text += f"\nAdditional medication info: {crestor_info}\n[Source: CRESTOR Full Prescribing Information (crestor_eng.pdf)]"

    # Insert the profile data into memory as a single context entry.
    memory.save_context({"input": "Profile"}, {"output": profile_text})
    print("Updated memory with profile:", profile_text)


def is_response_uncertain(response: str) -> bool:
    uncertainty_indicators = [
        "i'm not sure",
        "uncertain",
        "i don't have enough information",
    ]
    return any(ind in response.lower() for ind in uncertainty_indicators)


def is_sensitive_query(user_input: str) -> bool:
    sensitive_keywords = ["suicide", "self-harm", "harm myself", "i feel hopeless"]
    return any(word in user_input.lower() for word in sensitive_keywords)


def fallback_response(user_input: str, generated_response: str) -> str:
    if is_sensitive_query(user_input):
        return "I'm sorry you're experiencing these feelings. Please consider reaching out to a trusted healthcare provider or crisis intervention service immediately."
    elif is_response_uncertain(generated_response):
        return "I'm not completely sure about that. It would be best to consult a healthcare professional for personalized advice."
    return generated_response


def check_for_emergency(input_text: str) -> bool:
    emergency_keywords = [
        "emergency",
        "chest pain",
        "severe",
        "unconscious",
        "difficulty breathing",
        "shortness of breath",
    ]
    return any(keyword in input_text.lower() for keyword in emergency_keywords)


# -------------------------------
# FastAPI Setup
# -------------------------------
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production as needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------------------
# Pydantic Models
# -------------------------------
class ChatRequest(BaseModel):
    user_input: str
    profile: Optional[dict] = None


class ChatResponse(BaseModel):
    response: str


# -------------------------------
# Endpoints
# -------------------------------
@app.post("/chat", response_model=ChatResponse)
def chat_endpoint(chat_request: ChatRequest):
    user_input = chat_request.user_input
    print(f"User input: {user_input}")

    # If a new profile is provided, update the conversation memory.
    if chat_request.profile:
        print("Profile provided. Updating memory with new profile data.")
        insert_profile_into_memory(chat_request.profile)
    else:
        print("No profile provided with this request.")

    # Check for emergency keywords in the user input.
    if check_for_emergency(user_input):
        return ChatResponse(
            response="It sounds like you may be experiencing an emergency. Please seek immediate medical assistance or call your local emergency services."
        )

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


# -------------------------------
# Main
# -------------------------------
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
