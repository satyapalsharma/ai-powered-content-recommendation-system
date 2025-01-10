"""
main.py

This module serves as the main entry point for the Recommendation Engine service.
It exposes a FastAPI-based web server to provide content recommendations.

The service loads a pre-trained machine learning model upon startup and uses it
to generate personalized recommendations for a given user ID.
"""

import logging
import os
from contextlib import asynccontextmanager
from typing import Any, Dict, List

import joblib
import numpy as np
from fastapi import FastAPI, HTTPException, Path, Query
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings
from sklearn.metrics.pairwise import cosine_similarity

# --- Configuration ---
# Load configuration from environment variables for better security and flexibility.


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    """
    MODEL_PATH: str = "models/user_embedding_model.joblib"
    LOG_LEVEL: str = "INFO"
    # In a real-world scenario, item data would come from a database or another service.
    # For this example, we simulate a fixed number of items.
    NUM_ITEMS: int = 1000
    ITEM_EMBEDDING_DIM: int = 64


settings = Settings()

# --- Logging Setup ---
# Configure structured logging for production environments.

logging.basicConfig(
    level=settings.LOG_LEVEL.upper(),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# --- Application State ---
# Use a dictionary to hold application state, such as the loaded model.
# This avoids using global variables and makes state management explicit.

app_state: Dict[str, Any] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Asynchronous context manager to handle application startup and shutdown events.
    This is the modern replacement for @app.on_event("startup") / "shutdown".
    """
    logger.info("Application startup...")

    # 1. Load the pre-trained model
    model_path = settings.MODEL_PATH
    if not os.path.exists(model_path):
        logger.error(f"Model file not found at path: {model_path}")
        # In a real system, you might want the service to fail fast if the model is missing.
        # For this example, we'll set it to None and let endpoints handle the error.
        app_state["model"] = None
    else:
        try:
            app_state["model"] = joblib.load(model_path)
            logger.info(f"Successfully loaded model from {model_path}")
        except Exception as e:
            logger.error(f"Failed to load model from {model_path}: {e}")
            app_state["model"] = None

    # 2. Simulate loading or generating item embeddings
    # In a production system, these would be fetched from a vector database (e.g., Pinecone, Weaviate)
    # or a feature store, and would be updated periodically.
    # Here, we generate random embeddings for demonstration purposes.
    logger.info(f"Generating mock item embeddings for {settings.NUM_ITEMS} items...")
    np.random.seed(42)  # for reproducibility
    app_state["item_ids"] = [f"item_{i}" for i in range(settings.NUM_ITEMS)]
    app_state["item_embeddings"] = np.random.rand(
        settings.NUM_ITEMS, settings.ITEM_EMBEDDING_DIM
    ).astype(np.float32)
    logger.info("Mock item embeddings generated.")

    yield

    # --- Shutdown logic ---
    logger.info("Application shutdown...")
    app_state.clear()


# --- FastAPI Application ---

app = FastAPI(
    title="AI-Powered Content Recommendation System",
    description="Provides personalized content recommendations based on user embeddings.",
    version="1.0.0",
    lifespan=lifespan,
)

# --- Pydantic Models for API Data Contracts ---


class RecommendedItem(BaseModel):
    """
    Represents a single recommended item.
    """
    item_id: str = Field(..., description="The unique identifier for the recommended item.")
    score: float = Field(
        ...,
        description="A similarity score between 0 and 1, indicating recommendation relevance.",
        ge=0,
        le=1,
    )


class RecommendationResponse(BaseModel):
    """
    The response model for a recommendation request.
    """
    user_id: str = Field(..., description="The user for whom recommendations were generated.")
    recommendations: List[RecommendedItem] = Field(
        ..., description="A list of recommended items, sorted by relevance."
    )


# --- API Endpoints ---


@app.get("/health", tags=["Monitoring"])
def health_check():
    """
    Simple health check endpoint to verify that the service is running.
    """
    return {"status": "ok"}


@app.get(
    "/recommendations/{user_id}",
    response_model=RecommendationResponse,
    tags=["Recommendations"],
    summary="Get content recommendations for a user",
)
def get_recommendations(
    user_id: str = Path(
        ...,
        description="The unique identifier of the user.",
        example="user_123",
    ),
    count: int = Query(
        10,
        ge=1,
        le=100,
        description="The number of recommendations to return.",
    ),
):
    """
    Generates and returns a list of personalized content recommendations for a given user.

    - **user_id**: The ID of the user to get recommendations for.
    - **count**: The desired number of recommended items.
    """
    model = app_state.get("model")
    if model is None:
        logger.error("Model is not loaded, cannot serve recommendations.")
        raise HTTPException(
            status_code=503,
            detail="Recommendation model is not available. Please try again later.",
        )

    try:
        # 1. Generate user embedding
        # This assumes the model has a `predict` or `transform` method that takes a user ID.
        # In a real scenario, you might need to fetch user features first.
        # Here we simulate it by hashing the user_id to get a consistent pseudo-random vector.
        # A real model would have learned embeddings for known users.
        user_seed = int.from_bytes(user_id.encode(), 'little') % (2**32 - 1)
        np.random.seed(user_seed)
        user_embedding = np.random.rand(1, settings.ITEM_EMBEDDING_DIM).astype(np.float32)

        # This is where you would use the actual model if it were trained on user IDs:
        # For example: user_embedding = model.transform([user_id])
        logger.info(f"Generated embedding for user_id: {user_id}")

        # 2. Calculate similarity
        # Using cosine similarity to find items closest to the user in the embedding space.
        item_embeddings = app_state["item_embeddings"]
        similarity_scores = cosine_similarity(user_embedding, item_embeddings).flatten()

        # 3. Get top N recommendations
        # Get indices of the top N scores in descending order.
        top_indices = np.argsort(similarity_scores)[-count:][::-1]

        # 4. Format the response
        recommendations = [
            RecommendedItem(
                item_id=app_state["item_ids"][i],
                score=round(float(similarity_scores[i]), 4),
            )
            for i in top_indices
        ]

        logger.info(f"Successfully generated {len(recommendations)} recommendations for user_id: {user_id}")

        return RecommendationResponse(user_id=user_id, recommendations=recommendations)

    except Exception as e:
        logger.exception(f"An unexpected error occurred while generating recommendations for user {user_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="An internal error occurred while processing your request.",
        )


if __name__ == "__main__":
    # This block is for local development and allows running the app directly.
    # For production, a WSGI server like Uvicorn or Gunicorn should be used.
    # Example: uvicorn services.recommendation-engine.app.main:app --reload
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)