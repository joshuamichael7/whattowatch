import React from "react";
import { motion } from "framer-motion";
import SimilarContentSearch from "../SimilarContentSearch";

interface SimilarContentProps {
  onSelectItem: (item: any) => void;
  useDirectApi: boolean;
}

const SimilarContent: React.FC<SimilarContentProps> = ({
  onSelectItem,
  useDirectApi,
}) => {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <SimilarContentSearch
        onSelectItem={onSelectItem}
        useDirectApi={useDirectApi}
      />
    </motion.div>
  );
};

export default SimilarContent;
