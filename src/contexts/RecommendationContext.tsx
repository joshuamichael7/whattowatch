import React, { createContext, useContext, useState, useEffect } from "react";
import { ContentItem } from "@/types/omdb";

type RecommendationContextType = {
  recommendations: ContentItem[];
  allRecommendations: ContentItem[];
  selectedRecommendation: ContentItem | null;
  setRecommendations: (recommendations: ContentItem[]) => void;
  setAllRecommendations: (recommendations: ContentItem[]) => void;
  setSelectedRecommendation: (recommendation: ContentItem | null) => void;
  clearRecommendations: () => void;
};

export const RecommendationContext = createContext<RecommendationContextType>({
  recommendations: [],
  allRecommendations: [],
  selectedRecommendation: null,
  setRecommendations: () => {},
  setAllRecommendations: () => {},
  setSelectedRecommendation: () => {},
  clearRecommendations: () => {},
});

export function RecommendationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Initialize state from localStorage if available
  const [recommendations, setRecommendationsState] = useState<ContentItem[]>(
    () => {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("recommendations");
        if (saved) {
          try {
            return JSON.parse(saved);
          } catch (e) {
            console.error(
              "Failed to parse recommendations from localStorage:",
              e,
            );
            return [];
          }
        }
      }
      return [];
    },
  );

  const [allRecommendations, setAllRecommendationsState] = useState<
    ContentItem[]
  >(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("allRecommendations");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error(
            "Failed to parse allRecommendations from localStorage:",
            e,
          );
          return [];
        }
      }
    }
    return [];
  });

  const [selectedRecommendation, setSelectedRecommendationState] =
    useState<ContentItem | null>(() => {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("selectedRecommendation");
        if (saved) {
          try {
            return JSON.parse(saved);
          } catch (e) {
            console.error(
              "Failed to parse selectedRecommendation from localStorage:",
              e,
            );
            return null;
          }
        }
      }
      return null;
    });

  // Update localStorage when state changes
  useEffect(() => {
    if (recommendations.length > 0) {
      localStorage.setItem("recommendations", JSON.stringify(recommendations));
    }
  }, [recommendations]);

  useEffect(() => {
    if (allRecommendations.length > 0) {
      localStorage.setItem(
        "allRecommendations",
        JSON.stringify(allRecommendations),
      );
    }
  }, [allRecommendations]);

  useEffect(() => {
    if (selectedRecommendation) {
      localStorage.setItem(
        "selectedRecommendation",
        JSON.stringify(selectedRecommendation),
      );
    }
  }, [selectedRecommendation]);

  // Wrapper functions to update state
  const setRecommendations = (newRecommendations: ContentItem[]) => {
    setRecommendationsState(newRecommendations);
  };

  const setAllRecommendations = (newAllRecommendations: ContentItem[]) => {
    setAllRecommendationsState(newAllRecommendations);
  };

  const setSelectedRecommendation = (recommendation: ContentItem | null) => {
    setSelectedRecommendationState(recommendation);
  };

  const clearRecommendations = () => {
    setRecommendationsState([]);
    setAllRecommendationsState([]);
    setSelectedRecommendationState(null);
    localStorage.removeItem("recommendations");
    localStorage.removeItem("allRecommendations");
    localStorage.removeItem("selectedRecommendation");
  };

  const value = {
    recommendations,
    allRecommendations,
    selectedRecommendation,
    setRecommendations,
    setAllRecommendations,
    setSelectedRecommendation,
    clearRecommendations,
  };

  return (
    <RecommendationContext.Provider value={value}>
      {children}
    </RecommendationContext.Provider>
  );
}

export function useRecommendations() {
  return useContext(RecommendationContext);
}
