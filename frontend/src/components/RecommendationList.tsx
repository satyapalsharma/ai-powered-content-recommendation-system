import React, { useState, useEffect, useCallback, memo } from 'react';

// In a real-world application, these styles would be in a corresponding CSS Module file
// e.g., RecommendationList.module.css
const styles = {
  container: 'recommendation-list-container',
  title: 'recommendation-list-title',
  grid: 'recommendation-grid',
  card: 'recommendation-card',
  cardLink: 'recommendation-card-link',
  cardImage: 'recommendation-card-image',
  cardContent: 'recommendation-card-content',
  cardTitle: 'recommendation-card-title',
  cardDescription: 'recommendation-card-description',
  cardFooter: 'recommendation-card-footer',
  cardCategory: 'recommendation-card-category',
  loader: 'loader',
  error: 'error-message',
  empty: 'empty-state-message',
  skeletonCard: 'skeleton-card',
  skeletonImage: 'skeleton-image',
  skeletonText: 'skeleton-text',
};

/**
 * @enum {string}
 * @description Defines the possible categories for content recommendations.
 */
export enum ContentCategory {
  Article = 'ARTICLE',
  Video = 'VIDEO',
  Podcast = 'PODCAST',
  Course = 'COURSE',
}

/**
 * @interface Recommendation
 * @description Represents a single content recommendation item.
 */
export interface Recommendation {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  contentUrl: string;
  category: ContentCategory;
  score: number; // Relevance score from the ML model
}

/**
 * @interface RecommendationListProps
 * @description Props for the RecommendationList component.
 */
interface RecommendationListProps {
  userId: string;
  title?: string;
}

/**
 * @interface RecommendationCardProps
 * @description Props for the RecommendationCard component.
 */
interface RecommendationCardProps {
  item: Recommendation;
  onItemClick: (item: Recommendation) => void;
}

// --- API Interaction Layer ---
// In a larger application, this would be in a separate `services/api.ts` file.

/**
 * Fetches content recommendations for a given user.
 * @param {string} userId - The ID of the user to fetch recommendations for.
 * @param {AbortSignal} signal - The AbortSignal to cancel the request.
 * @returns {Promise<Recommendation[]>} A promise that resolves to an array of recommendations.
 */
const fetchRecommendations = async (userId: string, signal: AbortSignal): Promise<Recommendation[]> => {
  // The API Gateway would be the single entry point for the frontend.
  const response = await fetch(`/api/recommendations?userId=${userId}`, { signal });

  if (!response.ok) {
    // Handle different error statuses appropriately in a real app
    const errorData = await response.json().catch(() => ({ message: 'Failed to fetch recommendations' }));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
};

/**
 * Tracks a user interaction event, such as a click on a recommendation.
 * @param {string} userId - The ID of the user.
 * @param {string} contentId - The ID of the content that was interacted with.
 * @param {string} eventType - The type of event (e.g., 'click', 'view').
 */
const trackInteractionEvent = (userId: string, contentId: string, eventType: string): void => {
  // Fire-and-forget request to the event tracker via the API Gateway.
  // We don't need to wait for the response.
  navigator.sendBeacon('/api/track', JSON.stringify({
    userId,
    contentId,
    eventType,
    timestamp: new Date().toISOString(),
  }));
};


// --- Custom Hook for Data Fetching ---

/**
 * @hook useRecommendations
 * @description A custom hook to fetch and manage the state for content recommendations.
 * @param {string} userId - The user's ID.
 * @returns {{ recommendations: Recommendation[] | null; isLoading: boolean; error: string | null; }}
 */
const useRecommendations = (userId: string) => {
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    const abortController = new AbortController();
    
    const getRecommendations = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchRecommendations(userId, abortController.signal);
        setRecommendations(data);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'An unknown error occurred.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    getRecommendations();

    // Cleanup function to abort fetch on component unmount or userId change
    return () => {
      abortController.abort();
    };
  }, [userId]);

  return { recommendations, isLoading, error };
};


// --- Presentational Components ---

/**
 * A memoized component to render a skeleton loader for a recommendation card.
 */
const SkeletonCard: React.FC = memo(() => (
  <div className={`${styles.card} ${styles.skeletonCard}`}>
    <div className={`${styles.skeletonImage}`}></div>
    <div className={styles.cardContent}>
      <div className={`${styles.skeletonText}`} style={{ width: '80%', height: '24px' }}></div>
      <div className={`${styles.skeletonText}`} style={{ width: '95%', marginTop: '8px' }}></div>
      <div className={`${styles.skeletonText}`} style={{ width: '90%', marginTop: '4px' }}></div>
    </div>
  </div>
));

/**
 * A memoized component to render a single recommendation item.
 * @param {RecommendationCardProps} props - The component props.
 */
const RecommendationCard: React.FC<RecommendationCardProps> = memo(({ item, onItemClick }) => {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault(); // Prevent default navigation
    onItemClick(item);
    // In a real app, you might use Next.js router to navigate:
    // router.push(item.contentUrl);
    window.open(item.contentUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className={styles.card}>
      <a href={item.contentUrl} onClick={handleClick} className={styles.cardLink} aria-label={item.title}>
        <img src={item.imageUrl} alt={item.title} className={styles.cardImage} loading="lazy" />
        <div className={styles.cardContent}>
          <h3 className={styles.cardTitle}>{item.title}</h3>
          <p className={styles.cardDescription}>{item.description}</p>
        </div>
        <div className={styles.cardFooter}>
          <span className={styles.cardCategory}>{item.category}</span>
        </div>
      </a>
    </div>
  );
});

RecommendationCard.displayName = 'RecommendationCard';

// --- Main Component ---

/**
 * Renders a list of personalized content recommendations for a user.
 * It handles loading, error, and empty states.
 * @param {RecommendationListProps} props - The component props.
 */
const RecommendationList: React.FC<RecommendationListProps> = ({ userId, title = "Recommended For You" }) => {
  const { recommendations, isLoading, error } = useRecommendations(userId);

  /**
   * Handles the click event on a recommendation item.
   * Tracks the interaction and navigates the user.
   */
  const handleItemClick = useCallback((item: Recommendation) => {
    console.log(`Item clicked: ${item.id}, tracking event...`);
    trackInteractionEvent(userId, item.id, 'click');
  }, [userId]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className={styles.grid}>
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      );
    }

    if (error) {
      return <div className={styles.error}>Error: {error}</div>;
    }

    if (!recommendations || recommendations.length === 0) {
      return <div className={styles.empty}>No recommendations available at the moment.</div>;
    }

    return (
      <div className={styles.grid}>
        {recommendations.map((item) => (
          <RecommendationCard key={item.id} item={item} onItemClick={handleItemClick} />
        ))}
      </div>
    );
  };

  return (
    <section className={styles.container} aria-labelledby="recommendation-list-title">
      <h2 id="recommendation-list-title" className={styles.title}>{title}</h2>
      {renderContent()}
    </section>
  );
};

export default RecommendationList;