import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ContentFiltersProps {
  onFilterChange?: (filters: ContentFilterOptions) => void;
  initialFilters?: ContentFilterOptions;
}

export interface ContentFilterOptions {
  maturityLevel: string;
  familyFriendly: boolean;
  contentWarnings: string[];
  excludedGenres: string[];
  acceptedRatings?: string[];
}

const ContentFilters: React.FC<ContentFiltersProps> = ({
  onFilterChange = () => {},
  initialFilters = {
    maturityLevel: "PG",
    familyFriendly: false,
    contentWarnings: [],
    excludedGenres: [],
    acceptedRatings: [
      "G",
      "PG",
      "PG-13",
      "R",
      "TV-Y",
      "TV-PG",
      "TV-14",
      "TV-MA",
    ],
  },
}) => {
  const [filters, setFilters] = useState<ContentFilterOptions>(initialFilters);

  const handleMaturityChange = (value: string) => {
    const newFilters = { ...filters, maturityLevel: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleFamilyFriendlyChange = (checked: boolean) => {
    const newFilters = { ...filters, familyFriendly: checked };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleContentWarningToggle = (warning: string) => {
    const warnings = filters.contentWarnings.includes(warning)
      ? filters.contentWarnings.filter((w) => w !== warning)
      : [...filters.contentWarnings, warning];

    const newFilters = { ...filters, contentWarnings: warnings };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleGenreExclusionToggle = (genre: string) => {
    const genres = filters.excludedGenres.includes(genre)
      ? filters.excludedGenres.filter((g) => g !== genre)
      : [...filters.excludedGenres, genre];

    const newFilters = { ...filters, excludedGenres: genres };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const resetFilters = () => {
    const defaultFilters = {
      maturityLevel: "PG",
      familyFriendly: false,
      contentWarnings: [],
      excludedGenres: [],
      acceptedRatings: [
        "G",
        "PG",
        "PG-13",
        "R",
        "TV-Y",
        "TV-PG",
        "TV-14",
        "TV-MA",
      ],
    };
    setFilters(defaultFilters);
    onFilterChange(defaultFilters);
  };

  // Content warning options
  const contentWarningOptions = [
    { id: "violence", label: "Violence" },
    { id: "gore", label: "Gore" },
    { id: "profanity", label: "Strong Language" },
    { id: "nudity", label: "Nudity" },
    { id: "sexual_content", label: "Sexual Content" },
    { id: "substance_abuse", label: "Substance Abuse" },
    { id: "suicide", label: "Suicide/Self Harm" },
    { id: "disturbing", label: "Disturbing Imagery" },
  ];

  // Genre exclusion options
  const genreOptions = [
    { id: "horror", label: "Horror" },
    { id: "war", label: "War" },
    { id: "thriller", label: "Thriller" },
    { id: "crime", label: "Crime" },
    { id: "romance", label: "Romance" },
    { id: "comedy", label: "Comedy" },
    { id: "documentary", label: "Documentary" },
    { id: "animation", label: "Animation" },
  ];

  return (
    <Card className="w-full max-w-md bg-background shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Content Filters</span>
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Reset
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="maturity" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="maturity">Age Rating</TabsTrigger>
            <TabsTrigger value="warnings">Content Warnings</TabsTrigger>
            <TabsTrigger value="exclusions">Exclusions</TabsTrigger>
          </TabsList>

          <TabsContent value="maturity" className="space-y-4 pt-4">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Maximum Maturity Level</Label>
                  <Badge variant="outline">{filters.maturityLevel}</Badge>
                </div>
                <div className="pt-2">
                  <div className="flex justify-between text-xs text-muted-foreground mb-2">
                    <span>G</span>
                    <span>PG</span>
                    <span>PG-13</span>
                    <span>R</span>
                  </div>
                  <Tabs
                    value={filters.maturityLevel}
                    onValueChange={handleMaturityChange}
                    className="w-full"
                  >
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="G">G</TabsTrigger>
                      <TabsTrigger value="PG">PG</TabsTrigger>
                      <TabsTrigger value="PG-13">PG-13</TabsTrigger>
                      <TabsTrigger value="R">R</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <Label>Accepted Ratings</Label>
                    <Badge variant="outline">
                      {filters.acceptedRatings?.length || 0} selected
                    </Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      "G",
                      "PG",
                      "PG-13",
                      "R",
                      "TV-Y",
                      "TV-PG",
                      "TV-14",
                      "TV-MA",
                    ].map((rating) => (
                      <div key={rating} className="flex items-center space-x-2">
                        <Checkbox
                          id={`rating-${rating}`}
                          checked={
                            filters.acceptedRatings?.includes(rating) || false
                          }
                          onCheckedChange={(checked) => {
                            const newAcceptedRatings = checked
                              ? [...(filters.acceptedRatings || []), rating]
                              : (filters.acceptedRatings || []).filter(
                                  (r) => r !== rating,
                                );
                            const newFilters = {
                              ...filters,
                              acceptedRatings: newAcceptedRatings,
                            };
                            setFilters(newFilters);
                            onFilterChange(newFilters);
                          }}
                        />
                        <Label htmlFor={`rating-${rating}`} className="text-sm">
                          {rating}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between space-x-2">
                <div className="flex flex-col space-y-1">
                  <Label htmlFor="family-friendly" className="font-medium">
                    Family Friendly Mode
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    Stricter filtering for all-ages viewing
                  </span>
                </div>
                <Switch
                  id="family-friendly"
                  checked={filters.familyFriendly}
                  onCheckedChange={handleFamilyFriendlyChange}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="warnings" className="space-y-4 pt-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm text-muted-foreground">
                  Select content you want to be warned about
                </Label>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 pt-2">
              {contentWarningOptions.map((warning) => (
                <div key={warning.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`warning-${warning.id}`}
                    checked={filters.contentWarnings.includes(warning.id)}
                    onCheckedChange={() =>
                      handleContentWarningToggle(warning.id)
                    }
                  />
                  <Label htmlFor={`warning-${warning.id}`} className="text-sm">
                    {warning.label}
                  </Label>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="exclusions" className="space-y-4 pt-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center space-x-2 cursor-help">
                        <Info className="h-4 w-4 text-muted-foreground" />
                        <Label className="text-sm text-muted-foreground">
                          Exclude these genres from recommendations
                        </Label>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">
                        These genres won't appear in your recommendations
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              {genreOptions.map((genre) => (
                <div key={genre.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`genre-${genre.id}`}
                    checked={filters.excludedGenres.includes(genre.id)}
                    onCheckedChange={() => handleGenreExclusionToggle(genre.id)}
                  />
                  <Label htmlFor={`genre-${genre.id}`} className="text-sm">
                    {genre.label}
                  </Label>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default ContentFilters;
