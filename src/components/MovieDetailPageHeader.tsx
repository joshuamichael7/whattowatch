import React from "react";
import Header from "./layout/Header";

interface MovieDetailPageHeaderProps {
  title?: string;
}

const MovieDetailPageHeader: React.FC<MovieDetailPageHeaderProps> = ({
  title = "What to Watch",
}) => {
  return <Header title={title} />;
};

export default MovieDetailPageHeader;
