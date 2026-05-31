import type { NextPage } from 'next';
import Head from 'next/head';
import { useState, useEffect } from 'react';
import RecommendationList from '../components/RecommendationList';

// Define the shape of a single content item for type safety.
// This should match the data structure returned by the API gateway.
export interface ContentItem {
  id: string;
  title: string;
  description: string;
  type: 'article' | 'video' | 'course';
  imageUrl: string;
  url: string;
  score?: number; // Optional recommendation score
}

/**
 * The main home page of the application.
 * It fetches and displays personalized content recommendations for the current user.
 */
const HomePage: NextPage = () => {
  // State to hold the list of recommended content items
  const [recommendations, setRecommendations] = useState<ContentItem[]>([]);
  // State to manage the loading status while fetching data
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // State to store any errors that occur during the fetch operation
  const [error, setError] = useState<string | null>(null);

  // In a real-world application, the user ID would come from an authentication context (e.g., JWT, session).
  // For this example, we'll use a hardcoded user ID.
  const MOCK_USER_ID = 'user-123-abc';

  useEffect(() => {
    /**
     * Fetches content recommendations from the backend API.
     * This function is called once when the component mounts.
     */
    const fetchRecommendations = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // The API URL should be stored in environment variables for different environments (dev, prod).
        const apiUrl = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:8080';
        const response = await fetch(`${apiUrl}/recommendations?userId=${MOCK_USER_ID}`);

        if (!response.ok) {
          // Handle non-successful HTTP responses (e.g., 404, 500)
          throw new Error(`API request failed with status ${response.status}`);
        }

        const data: ContentItem[] = await response.json();
        setRecommendations(data);
      } catch (err) {
        console.error('Failed to fetch recommendations:', err);
        // Set a user-friendly error message
        setError('Could not load recommendations. Please try again later.');
      } finally {
        // Ensure loading is set to false after the fetch completes, regardless of outcome
        setIsLoading(false);
      }
    };

    fetchRecommendations();
  }, []); // The empty dependency array ensures this effect runs only once on mount.

  /**
   * Renders the main content based on the current state (loading, error, or success).
   */
  const renderContent = () => {
    if (isLoading) {
      return <div className="loading-indicator">Loading recommendations...</div>;
    }

    if (error) {
      return <div className="error-message">{error}</div>;
    }

    if (recommendations.length === 0) {
      return <div className="empty-state">No recommendations available at the moment.</div>;
    }

    return <RecommendationList items={recommendations} />;
  };

  return (
    <>
      <Head>
        <title>Personalized Recommendations | AI Content Platform</title>
        <meta name="description" content="Your daily dose of AI-powered content recommendations, tailored just for you." />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="container">
        <header className="header">
          <h1 className="title">For You</h1>
          <p className="subtitle">
            Discover content tailored to your interests, powered by our recommendation engine.
          </p>
        </header>

        <section className="content-section">
          {renderContent()}
        </section>
      </main>

      {/* Scoped JSX for styling. In a larger app, this would be in a separate CSS/SCSS module or use a framework like Tailwind CSS. */}
      <style jsx>{`
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem 1.5rem;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
            Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
          color: #333;
        }
        .header {
          text-align: center;
          margin-bottom: 3rem;
          border-bottom: 1px solid #eaeaea;
          padding-bottom: 2rem;
        }
        .title {
          font-size: 3rem;
          font-weight: 700;
          margin: 0;
          line-height: 1.15;
        }
        .subtitle {
          font-size: 1.25rem;
          color: #666;
          margin-top: 0.5rem;
        }
        .content-section {
          min-height: 300px; /* Provides space for loading/error messages */
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .loading-indicator,
        .error-message,
        .empty-state {
          font-size: 1.2rem;
          color: #888;
        }
        .error-message {
          color: #e53e3e; /* A reddish color for errors */
          background-color: #fff5f5;
          padding: 1rem 1.5rem;
          border-radius: 8px;
          border: 1px solid #fed7d7;
        }
      `}</style>
    </>
  );
};

export default HomePage;