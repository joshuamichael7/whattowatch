-- Example of how to use the bulk_import_content function
-- Copy your CSV data as JSON array and paste it between the brackets

SELECT * FROM bulk_import_content('[  
  {
    "Title": "The Shawshank Redemption",
    "Year": "1994",
    "imdbID": "tt0111161",
    "Type": "movie",
    "Poster": "https://m.media-amazon.com/images/M/MV5BNDE3ODcxYzMtY2YzZC00NmNlLWJiNDMtZDViZWM2MzIxZDYwXkEyXkFqcGdeQXVyNjAwNDUxODI@._V1_SX300.jpg",
    "Plot": "Over the course of several years, two convicts form a friendship, seeking consolation and, eventually, redemption through basic compassion.",
    "Rated": "R",
    "Runtime": "142 min",
    "Genre": "Drama",
    "Director": "Frank Darabont",
    "Actors": "Tim Robbins, Morgan Freeman, Bob Gunton",
    "imdbRating": "9.3"
  },
  {
    "Title": "The Godfather",
    "Year": "1972",
    "imdbID": "tt0068646",
    "Type": "movie",
    "Poster": "https://m.media-amazon.com/images/M/MV5BM2MyNjYxNmUtYTAwNi00MTYxLWJmNWYtYzZlODY3ZTk3OTFlXkEyXkFqcGdeQXVyNzkwMjQ5NzM@._V1_SX300.jpg",
    "Plot": "The aging patriarch of an organized crime dynasty transfers control of his clandestine empire to his reluctant son.",
    "Rated": "R",
    "Runtime": "175 min",
    "Genre": "Crime, Drama",
    "Director": "Francis Ford Coppola",
    "Actors": "Marlon Brando, Al Pacino, James Caan",
    "imdbRating": "9.2"
  }
]');

-- For larger datasets, you may need to split your data into multiple calls
-- to avoid hitting memory or timeout limits
