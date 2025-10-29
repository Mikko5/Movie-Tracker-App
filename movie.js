import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { createPortal } from 'react-dom';

// Helper component to render stars based on a score
const StarRating = ({ score }) => {
  const displayedScore = score || 0;

  const renderStars = () => {
    let stars = [];
    const fullStars = Math.floor(displayedScore);
    const hasHalfStar = (displayedScore % 1) !== 0;

    for (let i = 0; i < fullStars; i++) {
      stars.push(<span key={`full-${i}`} className="text-yellow-400">★</span>);
    }
    if (hasHalfStar) {
      stars.push(
        <span key="half" className="text-yellow-400 relative">
          <span className="absolute top-0 left-0 overflow-hidden w-1/2">★</span>
          <span className="text-gray-500">☆</span>
        </span>
      );
    }
    for (let i = stars.length; i < 5; i++) {
      stars.push(<span key={`empty-${i}`} className="text-gray-500">☆</span>);
    }
    return stars;
  };
  
  return (
    <span className="flex items-center text-xl">
      {renderStars()}
    </span>
  );
};

const Modal = ({ isOpen, children, onClose }) => {
  if (!isOpen) return null;
  return createPortal(
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white text-gray-900 rounded-xl shadow-lg max-w-lg w-full p-6 relative" onClick={(e) => e.stopPropagation()}>
        <button
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-900"
          onClick={onClose}
        >
          &times;
        </button>
        {children}
      </div>
    </div>,
    document.body
  );
};

const App = () => {
  // State for TMDb API key
  const [apiKey, setApiKey] = useState('');
  
  // State for search functionality
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  
  // State for the watched movies list
  const [watchedMovies, setWatchedMovies] = useState([]);
  const [listLoading, setListLoading] = useState(true);

  // Firestore and Auth state
  const [userId, setUserId] = useState(null);
  const [db, setDb] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [message, setMessage] = useState('');

  // State for the movie details modal (unified for add, view, and edit)
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add', 'view', 'edit'
  const [movieToAdd, setMovieToAdd] = useState(null);
  const [selectedMovie, setSelectedMovie] = useState(null);

  // State for movie details form
  const [selectedDate, setSelectedDate] = useState('');
  const [score, setScore] = useState(null);
  const [format, setFormat] = useState(''); // This is for the add/edit modal
  const [isRewatch, setIsRewatch] = useState(false);
  const [comment, setComment] = useState('');

  // State for delete confirmation
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  // State for the dynamic format dropdown in the ADD/EDIT modal
  const formatOptions = ["Netflix", "Prime", "HBO", "Disney+", "Online", "Cinema", "TV", "Npostart"];
  const [formatSearchTerm, setFormatSearchTerm] = useState('');
  const [showFormatDropdown, setShowFormatDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef(null);

  // --- States for filtering and sorting ---
  const [availableGenres, setAvailableGenres] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState('');
  const [sortCriteria, setSortCriteria] = useState('date'); // 'date', 'runtime', 'director'
  const [filterTerm, setFilterTerm] = useState(''); // New state for general search filter
  
  // --- New state for the filter panel modal
  const [showFilterModal, setShowFilterModal] = useState(false);

  // --- New states for director and year filtering ---
  const [availableDirectors, setAvailableDirectors] = useState([]);
  const [selectedDirector, setSelectedDirector] = useState('');
  const [directorSearchTerm, setDirectorSearchTerm] = useState('');
  const [showDirectorDropdown, setShowDirectorDropdown] = useState(false);
  const directorDropdownRef = useRef(null);

  const [availableYears, setAvailableYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [yearSearchTerm, setYearSearchTerm] = useState('');
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const yearDropdownRef = useRef(null);

  // --- New states specifically for the FILTER modal format dropdown ---
  const [selectedFilterFormat, setSelectedFilterFormat] = useState('');
  const [filterFormatSearchTerm, setFilterFormatSearchTerm] = useState('');
  const [showFilterFormatDropdown, setShowFilterFormatDropdown] = useState(false);
  const filterDropdownRef = useRef(null);

  // New state for import modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  
  // App ID for Firestore
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
  
  const API_BASE_URL = 'https://api.themoviedb.org/3';
  const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

  const [tmdbGenres, setTmdbGenres] = useState([]);

  // Sample data for initial setup
  const initialMovies = [
    {
      uniqueId: uuidv4(),
      id: 603,
      title: "The Matrix",
      poster_path: "/f84q4d9g6e0b7a8y3y5x1t2d4s5.jpg",
      release_date: "1999-03-30",
      watchedDate: "2024-05-15",
      director: "Lana Wachowski, Lilly Wachowski",
      runtime: 136,
      genres: [{ id: 878, name: "Science Fiction" }],
      myScore: 5,
      format: "Netflix",
      isRewatch: true,
      comment: "A groundbreaking film that changed the sci-fi genre forever. A must-watch."
    },
    {
      uniqueId: uuidv4(),
      id: 27205,
      title: "Inception",
      poster_path: "/9g86t1f1a56f2j7g6s2y4a7d9q3w4.jpg",
      release_date: "2010-07-15",
      watchedDate: "2024-05-10",
      director: "Christopher Nolan",
      runtime: 148,
      genres: [{ id: 878, name: "Science Fiction" }, { id: 28, name: "Action" }],
      myScore: 4.5,
      format: "Cinema",
      isRewatch: false,
      comment: "Complex and visually stunning. Still thinking about the ending."
    },
    {
      uniqueId: uuidv4(),
      id: 603,
      title: "The Matrix",
      poster_path: "/f84q4d9g6e0b7a8y3y5x1t2d4s5.jpg",
      release_date: "1999-03-30",
      watchedDate: "2024-05-20",
      director: "Lana Wachowski, Lilly Wachowski",
      runtime: 136,
      genres: [{ id: 878, name: "Science Fiction" }],
      myScore: 4,
      format: "Online",
      isRewatch: true,
      comment: "Still holds up! A classic."
    }
  ];

  useEffect(() => {
    const setupFirebase = async () => {
      try {
        const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
        const app = initializeApp(firebaseConfig);
        const firestore = getFirestore(app);
        const authService = getAuth(app);

        setDb(firestore);
        
        const token = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
        if (token) {
          await signInWithCustomToken(authService, token);
        } else {
          await signInAnonymously(authService);
        }
        
        onAuthStateChanged(authService, (user) => {
          if (user) {
            setUserId(user.uid);
            setIsAuthReady(true);
          } else {
            setUserId(uuidv4());
            setIsAuthReady(true);
          }
        });

      } catch (e) {
        setMessage(`Error setting up Firebase: ${e.message}`);
        setListLoading(false);
        console.error("Firebase setup error:", e);
      }
    };
    setupFirebase();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !db || !userId) {
      return;
    }

    const docRef = doc(db, `artifacts/${appId}/users/${userId}/movieData`, 'watched-history');
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      try {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const jsonString = data.list || '[]';
          setWatchedMovies(JSON.parse(jsonString));
        } else {
          if (userId) {
            const jsonString = JSON.stringify(initialMovies);
            setDoc(docRef, { list: jsonString }).catch(e => console.error("Error creating initial data:", e));
          }
        }
      } catch (e) {
        setMessage(`Error fetching data: ${e.message}`);
        console.error("Error fetching data from Firestore:", e);
      } finally {
        setListLoading(false);
      }
    }, (error) => {
      setMessage(`Listener error: ${error.message}`);
      console.error("Firestore listener error:", error);
    });

    return () => unsubscribe();
  }, [isAuthReady, db, userId, appId]);

  useEffect(() => {
    const genresMap = new Map();
    const directorsSet = new Set();
    const yearsSet = new Set();
    watchedMovies.forEach(movie => {
      if (movie.genres) {
        movie.genres.forEach(genre => {
          if (!genresMap.has(genre.id)) {
            genresMap.set(genre.id, genre);
          }
        });
      }
      if (movie.director) {
        directorsSet.add(movie.director);
      }
      if (movie.release_date) {
        yearsSet.add(movie.release_date.substring(0, 4));
      }
    });
    setAvailableGenres(Array.from(genresMap.values()));
    setAvailableDirectors(Array.from(directorsSet).sort());
    setAvailableYears(Array.from(yearsSet).sort((a, b) => b - a));
  }, [watchedMovies]);

  const fetchTmdbGenres = async () => {
    if (!apiKey.trim()) return;
    try {
        const response = await fetch(`${API_BASE_URL}/genre/movie/list`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            }
        });
        const data = await response.json();
        if (data.genres) {
            setTmdbGenres(data.genres);
        }
    } catch (e) {
        console.error("Failed to fetch TMDb genres:", e);
    }
  };

  useEffect(() => {
    fetchTmdbGenres();
  }, [apiKey]);

  const getImdbSearchUrl = (title, year) => {
    const formattedTitle = encodeURIComponent(`${title} ${year}`).replace(/%20/g, '+');
    return `https://www.imdb.com/find/?q=${formattedTitle}`;
  };

  const getLetterboxdSearchUrl = (title) => {
    if (!title) return '#';
    const formattedTitle = encodeURIComponent(title.toLowerCase()).replace(/%20/g, '-');
    return `https://letterboxd.com/search/films/${formattedTitle}/`;
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) {
      setMessage('Please enter a movie title to search.');
      return;
    }
    
    if (!apiKey.trim()) {
      setMessage('Please enter a valid TMDb v4 Access Token.');
      return;
    }

    setSearchLoading(true);
    setMessage('');
    setSearchResults([]);

    try {
      const response = await fetch(`${API_BASE_URL}/search/movie?query=${encodeURIComponent(searchTerm)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      });
      const data = await response.json();
      
      if (data.results) {
        setSearchResults(data.results.slice(0, 5));
        if (data.results.length === 0) {
          setMessage('No movies found. Try a different title.');
        }
      } else {
        setMessage(data.status_message || 'An error occurred during search.');
      }
    } catch (e) {
      setMessage('Failed to perform search. Check your network connection or API key.');
      console.error("Search API error:", e);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAddWatchedClick = async (movie) => {
    setSearchLoading(true);
    setMessage('Fetching movie details...');
    try {
        const movieDetailsResponse = await fetch(`${API_BASE_URL}/movie/${movie.id}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            }
        });
        const details = await movieDetailsResponse.json();
        
        const creditsResponse = await fetch(`${API_BASE_URL}/movie/${movie.id}/credits`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            }
        });
        const credits = await creditsResponse.json();

        const director = credits.crew.find(person => person.job === 'Director')?.name || 'N/A';
        const runtime = details.runtime || 'N/A';
        const movieGenres = details.genres || [];

        setMovieToAdd({ ...movie, director, runtime, genres: movieGenres });
        setSelectedDate('');
        setScore(null);
        setFormat('');
        setIsRewatch(false);
        setComment('');
        setFormatSearchTerm('');

        setModalMode('add');
        setShowDetailsModal(true);
    } catch (e) {
        setMessage('Failed to fetch movie details. Please try again.');
        console.error("Error fetching details:", e);
    } finally {
        setSearchLoading(false);
    }
  };
  
  const handleViewMovieClick = (movie) => {
    setSelectedMovie(movie);
    setSelectedDate(movie.watchedDate);
    setScore(movie.myScore);
    setFormat(movie.format);
    setIsRewatch(movie.isRewatch);
    setComment(movie.comment);
    setFormatSearchTerm(movie.format);
    setModalMode('view');
    setShowDetailsModal(true);
  };

  const saveNewMovie = async () => {
    if (!movieToAdd) return;

    setMessage('Saving...');
    setListLoading(true);

    try {
      const docRef = doc(db, `artifacts/${appId}/users/${userId}/movieData`, 'watched-history');
      
      const updatedMovies = [...watchedMovies, { 
        uniqueId: uuidv4(),
        id: movieToAdd.id,
        title: movieToAdd.title,
        poster_path: movieToAdd.poster_path,
        release_date: movieToAdd.release_date,
        watchedDate: selectedDate,
        director: movieToAdd.director,
        runtime: movieToAdd.runtime,
        genres: movieToAdd.genres,
        myScore: score,
        format: format,
        isRewatch: isRewatch,
        comment: comment
      }];
      
      const jsonString = JSON.stringify(updatedMovies);
      await setDoc(docRef, { list: jsonString });

      setSearchTerm('');
      setSearchResults([]);
      setMessage('Movie added to history!');
    } catch (e) {
      setMessage(`Failed to add movie: ${e.message}`);
      console.error("Error adding movie to Firestore:", e);
    } finally {
      closeModals();
      setListLoading(false);
    }
  };
  
  const updateExistingMovie = async () => {
    if (!selectedMovie) return;

    setMessage('Updating...');
    setListLoading(true);

    try {
        const docRef = doc(db, `artifacts/${appId}/users/${userId}/movieData`, 'watched-history');

        const updatedMovies = watchedMovies.map(movie => 
            movie.uniqueId === selectedMovie.uniqueId ? 
            {
                ...movie,
                watchedDate: selectedDate,
                myScore: score,
                format: format,
                isRewatch: isRewatch,
                comment: comment
            } : movie
        );

        const jsonString = JSON.stringify(updatedMovies);
        await setDoc(docRef, { list: jsonString });

        setMessage('Movie details updated!');
    } catch (e) {
        setMessage(`Failed to update movie: ${e.message}`);
        console.error("Error updating movie in Firestore:", e);
    } finally {
        closeModals();
        setListLoading(false);
    }
  };

  const handleDeleteMovie = async () => {
    if (!selectedMovie) return;

    setMessage('Deleting...');
    setListLoading(true);

    try {
      const docRef = doc(db, `artifacts/${appId}/users/${userId}/movieData`, 'watched-history');
      const updatedMovies = watchedMovies.filter(movie => movie.uniqueId !== selectedMovie.uniqueId);
      
      const jsonString = JSON.stringify(updatedMovies);
      await setDoc(docRef, { list: jsonString });
      
      setMessage('Movie successfully deleted!');
    } catch (e) {
      setMessage(`Failed to delete movie: ${e.message}`);
      console.error("Error deleting movie from Firestore:", e);
    } finally {
      closeModals();
      setListLoading(false);
    }
  };

  const handleImportMovies = async () => {
    if (!jsonInput.trim()) {
        setMessage('Please paste your JSON data into the text box.');
        return;
    }

    if (!apiKey.trim()) {
        setMessage('Please provide your TMDb v4 Access Token to fetch movie posters and details.');
        return;
    }

    setImportLoading(true);
    setMessage('Importing and fetching movie details from TMDb...');

    try {
        const importedData = JSON.parse(jsonInput);
        
        if (!Array.isArray(importedData)) {
            throw new Error("Invalid JSON format. Expected an array of movies.");
        }

        const moviesWithDetails = await Promise.all(importedData.map(async (item) => {
            const movie = {
                uniqueId: uuidv4(),
                myScore: item.REVIEW || null,
                format: item.FORMAT || 'N/A',
                isRewatch: item.REWATCH || false,
                comment: item.COMMENTS || '',
                watchedDate: item.DATE ? item.DATE.split('-').reverse().join('-') : 'N/A'
            };
            
            if (item.TITLE) {
                try {
                    const searchResponse = await fetch(`${API_BASE_URL}/search/movie?query=${encodeURIComponent(item.TITLE)}`, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        }
                    });
                    const searchData = await searchResponse.json();

                    if (searchData.results && searchData.results.length > 0) {
                        const tmdbId = searchData.results[0].id;
                        
                        const detailsResponse = await fetch(`${API_BASE_URL}/movie/${tmdbId}`, {
                            method: 'GET',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${apiKey}`
                            }
                        });
                        const detailsData = await detailsResponse.json();

                        const creditsResponse = await fetch(`${API_BASE_URL}/movie/${tmdbId}/credits`, {
                            method: 'GET',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${apiKey}`
                            }
                        });
                        const credits = await creditsResponse.json();
                        const director = credits.crew.find(person => person.job === 'Director')?.name || 'N/A';

                        movie.id = detailsData.id;
                        movie.title = detailsData.title;
                        movie.poster_path = detailsData.poster_path;
                        movie.release_date = detailsData.release_date;
                        movie.runtime = detailsData.runtime;
                        movie.genres = detailsData.genres;
                        movie.director = director;
                    }
                } catch (e) {
                    console.error(`Error fetching details for ${item.TITLE}:`, e);
                }
            }
            return movie;
        }));

        const docRef = doc(db, `artifacts/${appId}/users/${userId}/movieData`, 'watched-history');
        const updatedMovies = [...watchedMovies, ...moviesWithDetails];

        const jsonString = JSON.stringify(updatedMovies);
        await setDoc(docRef, { list: jsonString });

        setMessage(`Successfully imported ${importedData.length} movies!`);
        setJsonInput('');
    } catch (error) {
        setMessage(`Failed to import data: ${error.message}`);
        console.error("Import error:", error);
    } finally {
        setImportLoading(false);
        setShowImportModal(false);
    }
  };


  const today = new Date().toISOString().slice(0, 10);
  
  const formatDateForDisplay = (dateString) => {
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateString;
  };

  const filteredFormats = formatOptions.filter(opt =>
    opt.toLowerCase().includes(formatSearchTerm.toLowerCase())
  );
  
  const handleFormatChange = (e) => {
    setFormatSearchTerm(e.target.value);
    setFormat(e.target.value);
    setShowFormatDropdown(true);
    setHighlightedIndex(-1);
  };

  const handleSelectFormat = (selectedFormat) => {
    setFormat(selectedFormat);
    setFormatSearchTerm(selectedFormat);
    setShowFormatDropdown(false);
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prevIndex => 
        (prevIndex < filteredFormats.length - 1) ? prevIndex + 1 : prevIndex
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prevIndex => 
        (prevIndex > 0) ? prevIndex - 1 : 0
      );
    } else if (e.key === 'Enter' && highlightedIndex !== -1) {
      e.preventDefault();
      handleSelectFormat(filteredFormats[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setShowFormatDropdown(false);
    }
  };

  const filteredDirectors = availableDirectors.filter(opt =>
    opt.toLowerCase().includes(directorSearchTerm.toLowerCase())
  );

  const handleSelectDirector = (selected) => {
    setSelectedDirector(selected);
    setDirectorSearchTerm(selected);
    setShowDirectorDropdown(false);
  }

  const filteredYears = availableYears.filter(opt =>
    opt.includes(yearSearchTerm)
  );

  const handleSelectYear = (selected) => {
    setSelectedYear(selected);
    setYearSearchTerm(selected);
    setShowYearDropdown(false);
  }

  const filteredFilterFormats = formatOptions.filter(opt =>
    opt.toLowerCase().includes(filterFormatSearchTerm.toLowerCase())
  );

  const handleSelectFilterFormat = (selected) => {
    setSelectedFilterFormat(selected);
    setFilterFormatSearchTerm(selected);
    setShowFilterFormatDropdown(false);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowFormatDropdown(false);
      }
      if (directorDropdownRef.current && !directorDropdownRef.current.contains(e.target)) {
        setShowDirectorDropdown(false);
      }
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(e.target)) {
        setShowYearDropdown(false);
      }
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target)) {
        setShowFilterFormatDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const closeModals = () => {
    setShowDetailsModal(false);
    setShowDeleteConfirmation(false);
    setMovieToAdd(null);
    setSelectedMovie(null);
  };
  
  const sortedAndFilteredMovies = watchedMovies
    .filter(movie => 
      (!selectedGenre || (movie.genres && movie.genres.some(g => g.id === parseInt(selectedGenre)))) &&
      (!selectedDirector || movie.director === selectedDirector) &&
      (!selectedYear || (movie.release_date && movie.release_date.substring(0, 4) === selectedYear)) &&
      (!selectedFilterFormat || movie.format === selectedFilterFormat) &&
      (
        !filterTerm.trim() ||
        (movie.title && movie.title.toLowerCase().includes(filterTerm.toLowerCase())) ||
        (movie.director && movie.director.toLowerCase().includes(filterTerm.toLowerCase())) ||
        (movie.format && movie.format.toLowerCase().includes(filterTerm.toLowerCase())) ||
        (movie.comment && movie.comment.toLowerCase().includes(filterTerm.toLowerCase())) ||
        (movie.watchedDate && movie.watchedDate.includes(filterTerm)) ||
        (movie.release_date && movie.release_date.includes(filterTerm))
      )
    )
    .sort((a, b) => {
      if (sortCriteria === 'runtime') {
        return (b.runtime || 0) - (a.runtime || 0);
      }
      if (sortCriteria === 'director') {
        return (a.director || '').localeCompare(b.director || '');
      }
      return new Date(b.watchedDate) - new Date(a.watchedDate);
    });
    
  const clearFilters = () => {
    setFilterTerm('');
    setSelectedGenre('');
    setSortCriteria('date');
    setSelectedDirector('');
    setDirectorSearchTerm('');
    setSelectedYear('');
    setYearSearchTerm('');
    setSelectedFilterFormat('');
    setFilterFormatSearchTerm('');
  };


  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 p-8">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-6">My Watched Movies History</h1>

        {userId && (
            <p className="text-center text-sm text-gray-500 mb-4 break-all">
                Your User ID: <span className="font-mono">{userId}</span>
            </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left Column: API Key, Search & Results */}
          <div>
            <div className="mb-4">
              <label htmlFor="api-key" className="block text-sm font-medium text-gray-700">Enter TMDb v4 Access Token:</label>
              <input
                id="api-key"
                type="password"
                className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste your TMDb v4 Access Token here"
              />
            </div>

            <form onSubmit={handleSearch} className="flex gap-2 mb-4">
              <input
                type="text"
                className="flex-1 p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Search for a movie title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm hover:bg-indigo-700 disabled:bg-indigo-300"
                disabled={searchLoading || !apiKey}
              >
                {searchLoading ? 'Searching...' : 'Search'}
              </button>
            </form>

            {message && (
              <p className="text-center text-sm text-gray-500 mb-4">{message}</p>
            )}
            
            {searchResults.length > 0 && (
              <div className="mt-4">
                <h2 className="text-xl font-semibold mb-2">Search Results</h2>
                <ul className="space-y-2">
                  {searchResults.map((movie) => (
                    <li key={movie.id} className="p-2 border border-gray-200 rounded-md flex items-center gap-4">
                      <img 
                        src={movie.poster_path ? `${IMAGE_BASE_URL}${movie.poster_path}` : "https://placehold.co/50x75/dddddd/333333?text=No+Image"}
                        alt={movie.title}
                        className="w-12 h-18 rounded-md"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = "https://placehold.co/50x75/dddddd/333333?text=No+Image";
                        }}
                      />
                      <div className="flex-1">
                        <h3 className="font-bold">{movie.title}</h3>
                        <p className="text-sm text-gray-500">
                          {movie.release_date ? `(${movie.release_date.substring(0, 4)})` : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => handleAddWatchedClick(movie)}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-xs"
                      >
                        Add to History
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          
          {/* Right Column: Watched Movies History */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Your Watched Movies History</h2>
            
            <div className="flex justify-end gap-2 mb-4">
              <button
                onClick={() => setShowImportModal(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm"
              >
                Import
              </button>
              <button
                onClick={() => setShowFilterModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
              >
                Filter & Sort
              </button>
            </div>

            {listLoading && (
              <div className="text-center text-gray-500 mt-8">Loading...</div>
            )}

            {!listLoading && (
              <div className="max-h-[600px] overflow-y-auto pr-2">
                {sortedAndFilteredMovies.length > 0 ? (
                  <ul className="space-y-2">
                    {sortedAndFilteredMovies.map((movie) => (
                      <li 
                        key={movie.uniqueId} 
                        className="p-2 border border-gray-200 rounded-md flex items-center gap-4 cursor-pointer hover:bg-gray-50"
                        onClick={() => handleViewMovieClick(movie)}
                      >
                         <img 
                          src={movie.poster_path ? `${IMAGE_BASE_URL}${movie.poster_path}` : "https://placehold.co/50x75/dddddd/333333?text=No+Image"}
                          alt={movie.title}
                          className="w-12 h-18 rounded-md"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = "https://placehold.co/50x75/dddddd/333333?text=No+Image";
                          }}
                        />
                        <div className="flex-1">
                          <h3 className="font-bold">{movie.title}</h3>
                          <p className="text-sm text-gray-500">
                            {movie.release_date ? `(${movie.release_date.substring(0, 4)})` : ''}
                          </p>
                          {movie.watchedDate && (
                            <p className="text-xs text-gray-400 mt-1">Watched on: {formatDateForDisplay(movie.watchedDate)}</p>
                          )}
                          {movie.myScore && (
                            <div className="flex items-center text-sm text-gray-400">
                              <span className="font-bold mr-1">My Score:</span> <StarRating score={movie.myScore} />
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-center text-gray-500 mt-8">No movies match your criteria.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* --- Modals Section --- */}
        
        {/* Import Modal */}
        <Modal isOpen={showImportModal} onClose={() => setShowImportModal(false)}>
          <h3 className="text-xl font-semibold mb-4">Import Movies from JSON</h3>
          <p className="text-gray-600 mb-4">
            Paste your JSON data below.
          </p>
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder="Paste your JSON data here..."
            rows="10"
            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
          <div className="flex justify-end gap-2 mt-4">
            <button
                onClick={handleImportMovies}
                disabled={importLoading}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-purple-300"
            >
                {importLoading ? 'Importing...' : 'Import Movies'}
            </button>
            <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400"
            >
                Cancel
            </button>
          </div>
        </Modal>

        {/* Filter & Sort Modal */}
        <Modal isOpen={showFilterModal} onClose={() => setShowFilterModal(false)}>
          <h3 className="text-xl font-semibold mb-4">Filter & Sort Movies</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <label htmlFor="filter-search" className="block text-sm font-medium text-gray-700">General Search</label>
              <input
                id="filter-search"
                type="text"
                placeholder="Search titles, comments, etc."
                value={filterTerm}
                onChange={(e) => setFilterTerm(e.target.value)}
                className="w-full mt-1 p-2 border border-gray-300 rounded-md shadow-sm"
              />
            </div>
            
            <div className="relative">
              <label htmlFor="sort-by" className="block text-sm font-medium text-gray-700">Sort By</label>
              <select
                id="sort-by"
                value={sortCriteria}
                onChange={(e) => setSortCriteria(e.target.value)}
                className="w-full mt-1 p-2 border border-gray-300 rounded-md shadow-sm"
              >
                <option value="date">Date Watched</option>
                <option value="runtime">Runtime</option>
                <option value="director">Director</option>
              </select>
            </div>
            
            <div className="relative">
              <label htmlFor="genre-filter" className="block text-sm font-medium text-gray-700">Filter by Genre</label>
              <select
                id="genre-filter"
                value={selectedGenre}
                onChange={(e) => setSelectedGenre(e.target.value)}
                className="w-full mt-1 p-2 border border-gray-300 rounded-md shadow-sm"
              >
                <option value="">All Genres</option>
                {availableGenres.map(genre => (
                  <option key={genre.id} value={genre.id}>{genre.name}</option>
                ))}
              </select>
            </div>
            
            <div className="relative" ref={directorDropdownRef}>
              <label htmlFor="director-filter" className="block text-sm font-medium text-gray-700">Director</label>
              <input
                type="text"
                id="director-filter"
                value={directorSearchTerm}
                onChange={(e) => {
                  setDirectorSearchTerm(e.target.value);
                  setSelectedDirector('');
                  setShowDirectorDropdown(true);
                }}
                onFocus={() => setShowDirectorDropdown(true)}
                placeholder="Search or select a director"
                className="w-full mt-1 p-2 border border-gray-300 rounded-md shadow-sm"
              />
              {showDirectorDropdown && (
                <ul className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-b-md shadow-lg mt-1 max-h-48 overflow-y-auto z-10">
                  <li onClick={() => handleSelectDirector('')} className="p-2 cursor-pointer hover:bg-gray-100">- Any Director -</li>
                  {filteredDirectors.map((director) => (
                    <li key={director} onClick={() => handleSelectDirector(director)} className="p-2 cursor-pointer hover:bg-gray-100">
                      {director}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="relative" ref={yearDropdownRef}>
              <label htmlFor="year-filter" className="block text-sm font-medium text-gray-700">Release Year</label>
              <input
                type="text"
                id="year-filter"
                value={yearSearchTerm}
                onChange={(e) => {
                  setYearSearchTerm(e.target.value);
                  setSelectedYear('');
                  setShowYearDropdown(true);
                }}
                onFocus={() => setShowYearDropdown(true)}
                placeholder="Search or select a year"
                className="w-full mt-1 p-2 border border-gray-300 rounded-md shadow-sm"
              />
              {showYearDropdown && (
                <ul className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-b-md shadow-lg mt-1 max-h-48 overflow-y-auto z-10">
                  <li onClick={() => handleSelectYear('')} className="p-2 cursor-pointer hover:bg-gray-100">- Any Year -</li>
                  {filteredYears.map((year) => (
                    <li key={year} onClick={() => handleSelectYear(year)} className="p-2 cursor-pointer hover:bg-gray-100">
                      {year}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            
            <div className="relative" ref={filterDropdownRef}>
              <label htmlFor="format-filter" className="block text-sm font-medium text-gray-700">Watched Format</label>
              <input
                type="text"
                id="format-filter"
                value={filterFormatSearchTerm}
                onChange={(e) => {
                  setFilterFormatSearchTerm(e.target.value);
                  setSelectedFilterFormat('');
                  setShowFilterFormatDropdown(true);
                }}
                onFocus={() => setShowFilterFormatDropdown(true)}
                placeholder="Search or select a format"
                className="w-full mt-1 p-2 border border-gray-300 rounded-md shadow-sm"
              />
              {showFilterFormatDropdown && (
                <ul className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-b-md shadow-lg mt-1 max-h-48 overflow-y-auto z-10">
                  <li onClick={() => handleSelectFilterFormat('')} className="p-2 cursor-pointer hover:bg-gray-100">- Any Format -</li>
                  {filteredFilterFormats.map((option) => (
                    <li key={option} onClick={() => handleSelectFilterFormat(option)} className="p-2 cursor-pointer hover:bg-gray-100">
                      {option}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 text-sm"
            >
              Clear Filters
            </button>
            <button
              onClick={() => setShowFilterModal(false)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              Apply Filters
            </button>
          </div>
        </Modal>

        <Modal isOpen={showDetailsModal} onClose={closeModals}>
          <h3 className="text-xl font-semibold mb-4">
            {modalMode === 'add' ? `Add Details for ${movieToAdd?.title}` : `Movie Details: ${selectedMovie?.title}`}
          </h3>
          
          <div className="flex gap-4 justify-center mb-4">
            <a 
              href={getImdbSearchUrl((modalMode === 'add' ? movieToAdd : selectedMovie)?.title, (modalMode === 'add' ? movieToAdd : selectedMovie)?.release_date?.substring(0, 4))} 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-3 py-1 text-sm bg-yellow-500 text-white rounded-full hover:bg-yellow-600"
            >
              IMDb
            </a>
            <a 
              href={getLetterboxdSearchUrl((modalMode === 'add' ? movieToAdd : selectedMovie)?.title)} 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-3 py-1 text-sm bg-green-600 text-white rounded-full hover:bg-green-700"
            >
              Letterboxd
            </a>
          </div>

          <div className="flex items-start gap-4 mb-4">
            <img 
              src={(modalMode === 'add' ? movieToAdd : selectedMovie)?.poster_path ? `${IMAGE_BASE_URL}${(modalMode === 'add' ? movieToAdd : selectedMovie)?.poster_path}` : "https://placehold.co/100x150/dddddd/333333?text=No+Image"}
              alt={(modalMode === 'add' ? movieToAdd : selectedMovie)?.title}
              className="w-24 h-auto rounded-md flex-shrink-0"
            />
            <div className="flex-1">
              <p className="text-sm text-gray-600"><span className="font-bold">Director:</span> {(modalMode === 'add' ? movieToAdd : selectedMovie)?.director}</p>
              <p className="text-sm text-gray-600"><span className="font-bold">Runtime:</span> {(modalMode === 'add' ? movieToAdd : selectedMovie)?.runtime} min</p>
              <p className="text-sm text-gray-600"><span className="font-bold">Genres:</span> {(modalMode === 'add' ? movieToAdd : selectedMovie)?.genres?.map(g => g.name).join(', ') || 'N/A'}</p>
            </div>
          </div>
          
          <div className="space-y-4">
            {modalMode === 'view' ? (
              <div>
                <p><span className="font-bold">Watched on:</span> {formatDateForDisplay(selectedDate)}</p>
                <p><span className="font-bold">My Score:</span> <StarRating score={score} /></p>
                <p><span className="font-bold">Watched Format:</span> {format}</p>
                <p><span className="font-bold">Rewatch:</span> {isRewatch ? 'Yes' : 'No'}</p>
                {comment && (
                  <div className="mt-2 p-2 bg-gray-100 rounded-md">
                    <span className="font-bold block mb-1">My Comment:</span>
                    <p className="text-sm">{comment}</p>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor="watchedDate" className="block text-sm font-medium text-gray-700">Watched Date</label>
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={() => setSelectedDate(today)}
                      className="px-3 py-1 bg-gray-200 text-sm rounded-md hover:bg-gray-300"
                    >
                      Today
                    </button>
                    <input
                      type="date"
                      id="watchedDate"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="flex-1 p-2 border border-gray-300 rounded-md shadow-sm"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="score" className="block text-sm font-medium text-gray-700">My Score (1-5)</label>
                  <select
                    id="score"
                    value={score || ''}
                    onChange={(e) => setScore(Number(e.target.value))}
                    className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
                  >
                    <option value="" disabled>Select a score</option>
                    <option value="1">1</option>
                    <option value="1.5">1.5</option>
                    <option value="2">2</option>
                    <option value="2.5">2.5</option>
                    <option value="3">3</option>
                    <option value="3.5">3.5</option>
                    <option value="4">4</option>
                    <option value="4.5">4.5</option>
                    <option value="5">5</option>
                  </select>
                </div>

                <div className="relative" ref={dropdownRef}>
                  <label htmlFor="format" className="block text-sm font-medium text-gray-700">Watched Format</label>
                  <input
                    type="text"
                    id="format"
                    value={formatSearchTerm}
                    onChange={handleFormatChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setShowFormatDropdown(true)}
                    placeholder="Type to search for a format..."
                    className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
                  />
                  {showFormatDropdown && filteredFormats.length > 0 && (
                    <ul className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-b-md shadow-lg mt-1 max-h-48 overflow-y-auto z-10">
                      {filteredFormats.map((option, index) => (
                        <li
                          key={option}
                          onClick={() => handleSelectFormat(option)}
                          className={`p-2 cursor-pointer hover:bg-gray-100 ${index === highlightedIndex ? 'bg-gray-100' : ''}`}
                        >
                          {option}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="rewatch"
                    checked={isRewatch}
                    onChange={(e) => setIsRewatch(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <label htmlFor="rewatch" className="text-sm text-gray-700">Is this a rewatch?</label>
                </div>

                <div>
                  <label htmlFor="comment" className="block text-sm font-medium text-gray-700">My Comment</label>
                  <textarea
                    id="comment"
                    rows="3"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Add your thoughts about the movie..."
                    className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
                  ></textarea>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-2 mt-4 justify-end">
            {modalMode === 'add' && (
              <button
                onClick={saveNewMovie}
                disabled={!selectedDate || score === null}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-300"
              >
                Save Movie
              </button>
            )}
            {modalMode === 'view' && (
              <button
                onClick={() => setModalMode('edit')}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Edit Details
              </button>
            )}
            {modalMode === 'edit' && (
              <button
                onClick={updateExistingMovie}
                disabled={!selectedDate || score === null}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-300"
              >
                Save Changes
              </button>
            )}
            {modalMode !== 'add' && (
              <button
                onClick={() => setShowDeleteConfirmation(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Delete Movie
              </button>
            )}
            <button
              onClick={closeModals}
              className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400"
            >
              {modalMode === 'add' ? 'Cancel' : 'Close'}
            </button>
          </div>
        </Modal>

        <Modal isOpen={showDeleteConfirmation} onClose={() => setShowDeleteConfirmation(false)}>
          <h3 className="text-lg font-semibold mb-2">Are you sure?</h3>
          <p className="text-gray-600 mb-4">This action cannot be undone. Do you want to delete <span className="font-bold">{selectedMovie?.title}</span>?</p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={handleDeleteMovie}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Yes, Delete
            </button>
            <button
              onClick={() => setShowDeleteConfirmation(false)}
              className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400"
            >
              No, Keep it
            </button>
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default App;
