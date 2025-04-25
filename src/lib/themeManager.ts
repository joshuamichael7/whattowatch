// Theme management utility

// Available themes
export type ThemeOption =
  | "default"
  | "retro"
  | "modern"
  | "playful"
  | "futuristic"
  | "cinematic";

// Theme class mapping
const themeClasses: Record<ThemeOption, string> = {
  default: "", // Default theme has no class
  retro: "theme-retro",
  modern: "theme-modern",
  playful: "theme-playful",
  futuristic: "theme-futuristic",
  cinematic: "theme-cinematic",
};

// Theme display names
export const themeNames: Record<ThemeOption, string> = {
  default: "Bold & Electric",
  retro: "Retro Synthwave",
  modern: "Understated Modern",
  playful: "Playful & Pastel",
  futuristic: "Futuristic & Sleek",
  cinematic: "Warm & Cinematic",
};

// Local storage key
const THEME_STORAGE_KEY = "moviematch-theme";

// Get a random theme
export const getRandomTheme = (): ThemeOption => {
  const themes = Object.keys(themeClasses) as ThemeOption[];
  const randomIndex = Math.floor(Math.random() * themes.length);
  return themes[randomIndex];
};

// Set the theme
export const setTheme = (theme: ThemeOption): void => {
  // Remove all theme classes
  document.documentElement.classList.remove(
    ...Object.values(themeClasses).filter(Boolean),
  );

  // Add the new theme class if it's not the default
  if (theme !== "default" && themeClasses[theme]) {
    document.documentElement.classList.add(themeClasses[theme]);
  }

  // Save to local storage
  localStorage.setItem(THEME_STORAGE_KEY, theme);
};

// Get the current theme
export const getCurrentTheme = (): ThemeOption => {
  const savedTheme = localStorage.getItem(
    THEME_STORAGE_KEY,
  ) as ThemeOption | null;
  return savedTheme || "default";
};

// Initialize theme (either from storage or random)
export const initializeTheme = (useRandom = true): ThemeOption => {
  const savedTheme = localStorage.getItem(
    THEME_STORAGE_KEY,
  ) as ThemeOption | null;

  // If we have a saved theme, use it
  if (savedTheme && Object.keys(themeClasses).includes(savedTheme)) {
    setTheme(savedTheme);
    return savedTheme;
  }

  // Otherwise, use random theme if requested
  if (useRandom) {
    const randomTheme = getRandomTheme();
    setTheme(randomTheme);
    return randomTheme;
  }

  // Default to the default theme
  setTheme("default");
  return "default";
};
