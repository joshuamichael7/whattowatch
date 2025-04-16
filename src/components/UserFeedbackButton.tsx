import React from "react";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/components/ui/use-toast";

interface UserFeedbackButtonProps {
  contentId: string;
  sourceContentId?: string;
  isPositive: boolean;
  variant?:
    | "default"
    | "outline"
    | "secondary"
    | "ghost"
    | "link"
    | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  showIcon?: boolean;
  showText?: boolean;
  onFeedbackSubmitted?: (success: boolean) => void;
}

const UserFeedbackButton: React.FC<UserFeedbackButtonProps> = ({
  contentId,
  sourceContentId,
  isPositive,
  variant = "outline",
  size = "sm",
  className = "",
  showIcon = true,
  showText = true,
  onFeedbackSubmitted = () => {},
}) => {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleFeedback = async () => {
    if (!contentId) return;

    setIsSubmitting(true);

    try {
      // First try to submit directly to Supabase
      const { error } = await supabase.from("user_feedback").insert({
        content_id: contentId,
        source_content_id: sourceContentId || null,
        is_positive: isPositive,
        // user_id is null for anonymous feedback
      });

      if (error) {
        console.error("Error submitting feedback to Supabase:", error);
        throw error;
      }

      toast({
        title: isPositive
          ? "Thanks for the feedback!"
          : "Thanks for the feedback!",
        description: isPositive
          ? "We'll recommend more content like this"
          : "We'll show less content like this",
        variant: "default",
      });

      onFeedbackSubmitted(true);
    } catch (err) {
      console.error("Error submitting feedback:", err);

      // Fallback to Netlify function if direct Supabase insert fails
      try {
        const response = await fetch("/.netlify/functions/feedback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contentId,
            sourceContentId,
            isPositive,
            userId: "anonymous", // Anonymous feedback
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        toast({
          title: isPositive
            ? "Thanks for the feedback!"
            : "Thanks for the feedback!",
          description: isPositive
            ? "We'll recommend more content like this"
            : "We'll show less content like this",
          variant: "default",
        });

        onFeedbackSubmitted(true);
      } catch (fallbackErr) {
        console.error("Error submitting feedback via fallback:", fallbackErr);

        toast({
          title: "Feedback Error",
          description:
            "Unable to submit your feedback. Please try again later.",
          variant: "destructive",
        });

        onFeedbackSubmitted(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleFeedback}
      disabled={isSubmitting}
    >
      {showIcon &&
        (isPositive ? (
          <ThumbsUp className={`h-4 w-4 ${showText ? "mr-2" : ""}`} />
        ) : (
          <ThumbsDown className={`h-4 w-4 ${showText ? "mr-2" : ""}`} />
        ))}
      {showText && (isPositive ? "Like" : "Dislike")}
      {isSubmitting && <span className="ml-2 animate-pulse">...</span>}
    </Button>
  );
};

export default UserFeedbackButton;
