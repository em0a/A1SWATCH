const API_KEY = '66c7ed038d638cba14a961fb67d60f81';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/original';

// Core State Data Cache
let currentItem;
let rawMoviesCache = [];
let rawTvShowsCache = [];
let rawAnimeCache = [];
let rawUpcomingCache = []; // NEW: Dedicated upcoming data cache segment

// Fetch Genre Maps on load to handle structural category filtering
async function fetchAndInjectGenres() {
  try {
    const movieRes = await fetch(`${BASE_URL}/genre/movie/list?api_key=${API_KEY}`);
    const movieData = await movieRes.json();
    
    const tvRes = await fetch(`${BASE_URL}/genre/tv/list?api_key=${API_KEY}`);
    const tvData = await tvRes.json();

    // Merge unique entries safely
    const genreMap = {};
    movieData.genres.forEach(g => genreMap[g.id] = g.name);
    tvData.genres.forEach(g => genreMap[g.id] = g.name);

    const selectElement = document.getElementById('global-genre-select');
    
    for (const [id, name] of Object.entries(genreMap)) {
      if (parseInt(id) === 16) continue; // Skip standalone Animation since Anime row handles it
      const option = document.createElement('option');
      option.value = id;
      option.textContent = `${name.toUpperCase()} // SUB_SECTOR`;
      selectElement.appendChild(option);
    }
  } catch (error) {
    console.error("Failed to map system category genres:", error);
  }
}

// Global Content Fetch Matrix Core (Switches dynamically to Discover API for full genre lists)
async function fetchMediaData(mediaType, genreId = 'all') {
  let url = '';
  
  if (genreId === 'all') {
    url = `${BASE_URL}/trending/${mediaType}/week?api_key=${API_KEY}`;
  } else {
    url = `${BASE_URL}/discover/${mediaType}?api_key=${API_KEY}&with_genres=${genreId}&sort_by=popularity.desc&page=1`;
  }

  try {
    const res = await fetch(url);
    const data = await res.json();
    return data.results.map(item => ({ ...item, media_type: mediaType }));
  } catch (error) {
    console.error(`Error requesting ${mediaType} list data:`, error);
    return [];
  }
}

// NEW: Fetch upcoming unreleased files directly from the TMDB database pipeline
async function fetchUpcomingMovies(genreId = 'all') {
  let url = `${BASE_URL}/movie/upcoming?api_key=${API_KEY}&page=1`;
  if (genreId !== 'all') {
    url += `&with_genres=${genreId}`;
  }

  try {
    const res = await fetch(url);
    const data = await res.json();
    // Explicitly tag context as an unreleased upcoming file structure
    return data.results.map(item => ({ ...item, media_type: 'movie', is_upcoming: true }));
  } catch (error) {
    console.error("Error pulling upcoming archives:", error);
    return [];
  }
}

// Specialized Anime Ingestion Pipeline (Switches to Discover API for genres, falls back to trending animations)
async function fetchAnimeData(genreId = 'all') {
  let allResults = [];
  try {
    for (let page = 1; page <= 3; page++) {
      let url = '';
      if (genreId === 'all') {
        url = `${BASE_URL}/trending/tv/week?api_key=${API_KEY}&page=${page}`;
      } else {
        url = `${BASE_URL}/discover/tv?api_key=${API_KEY}&with_genres=16,${genreId}&sort_by=popularity.desc&page=${page}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      
      const filtered = data.results.filter(item =>
        item.original_language === 'ja' && item.genre_ids.includes(16)
      );
      allResults = allResults.concat(filtered);
    }
  } catch (error) {
    console.error("Anime data matrix extraction failed:", error);
  }
  return allResults.map(item => ({ ...item, media_type: 'tv' }));
}

function displayBanner(item) {
  if (!item) return;
  document.getElementById('banner').style.backgroundImage = `url(${IMG_URL}${item.backdrop_path})`;
  document.getElementById('banner-title').textContent = item.title || item.name;
}

function displayList(items, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return; // Prevent crashes if specific layout element rows are skipped
  container.innerHTML = '';
  
  if (items.length === 0) {
    container.innerHTML = '<p class="terminal-empty">// DATA_STREAM_EMPTY: NO COMPATIBLE RECORDS DECRYPTED FOR THIS CORE ID</p>';
    return;
  }

  items.forEach(item => {
    if (!item.poster_path) return;
    const img = document.createElement('img');
    img.src = `${IMG_URL}${item.poster_path}`;
    img.alt = item.title || item.name;
    img.onclick = () => showDetails(item);
    container.appendChild(img);
  });
}

// Master execution node that fires a brand-new discover handshake request across the whole catalog
async function onGenreChange() {
  const selectedGenre = document.getElementById('global-genre-select').value;
  const selectElement = document.getElementById('global-genre-select');
  const selectedText = selectElement.options[selectElement.selectedIndex].text.split(' //')[0];

  // Update row headings to represent the target filter sector query
  const rowSuffix = selectedGenre === 'all' ? 'TRENDING' : selectedText;
  document.querySelector('.row:nth-of-type(1) h2').textContent = `MOVIES_MATRIX // ${rowSuffix}`;
  document.querySelector('.row:nth-of-type(2) h2').textContent = `TV_SERIES_CHANNELS // ${rowSuffix}`;
  document.querySelector('.row:nth-of-type(3) h2').textContent = `ANIME_SUB_MATRIX // ${rowSuffix}`;

  // Re-fetch entire deep database pages instead of reading old compressed cache pools
  const freshMovies = await fetchMediaData('movie', selectedGenre);
  const freshTvShows = await fetchMediaData('tv', selectedGenre);
  const freshAnime = await fetchAnimeData(selectedGenre);
  const freshUpcoming = await fetchUpcomingMovies(selectedGenre); // Update upcoming data values

  displayList(freshMovies, 'movies-list');
  displayList(freshTvShows, 'tvshows-list');
  displayList(freshAnime, 'anime-list');
  displayList(freshUpcoming, 'upcoming-list'); // Render onto upcoming grid
}

async function showDetails(item) {
  currentItem = item;
  
  // Parse date parameters to extract year information cleanly
  const releaseDate = item.release_date || item.first_air_date || "";
  const releaseYear = releaseDate ? ` [${releaseDate.split('-')[0]}]` : " [YEAR_UNKNOWN]";

  document.getElementById('modal-title').textContent = (item.title || item.name) + releaseYear;
  document.getElementById('modal-description').textContent = item.overview || "No transmission log overview available.";
  document.getElementById('modal-image').src = `${IMG_URL}${item.poster_path}`;
  document.getElementById('modal-rating').innerHTML = '★'.repeat(Math.round((item.vote_average || 0) / 2));
  
  const tvControls = document.getElementById('tv-controls');
  const serverSelector = document.querySelector('.server-selector');
  const videoContainer = document.querySelector('.video-frame-container');
  
  document.getElementById('modal-video').src = '';

  // NEW: Validate if file target is flagged as upcoming unreleased data
  if (item.is_upcoming) {
    tvControls.style.display = 'none';
    if (serverSelector) serverSelector.style.display = 'none'; // Lock ingestion core dropdown
    if (videoContainer) videoContainer.style.display = 'none';   // Completely vanish the video player interface
    
    // Add custom upcoming system message to synopsis field
    document.getElementById('modal-description').insertAdjacentHTML('beforeend', 
      `<br><br><span style="color: var(--accent-red); font-weight: bold;">// ACCESS_DENIED: MEDIA UNRELEASED. PREVIEW PROTOCOL ACTIVE. RESIDUAL STREAMS UNAVAILABLE UNTIL OFFICIAL PREMIERE DATE (${releaseDate || "PENDING"}).</span>`
    );
  } else {
    // Normal operational logic for playable files
    if (serverSelector) serverSelector.style.display = 'flex';
    if (videoContainer) videoContainer.style.display = 'block';

    if (item.media_type === "tv") {
      tvControls.style.display = 'flex';
      await populateSeasons(item.id);
    } else {
      tvControls.style.display = 'none';
      changeServer();
    }
  }
  
  document.getElementById('modal').style.display = 'flex';
}

async function populateSeasons(tvId) {
  const seasonSelect = document.getElementById('season-select');
  seasonSelect.innerHTML = '<option value="">Reading season records...</option>';
  
  try {
    const res = await fetch(`${BASE_URL}/tv/${tvId}?api_key=${API_KEY}`);
    const detailedShow = await res.json();
    seasonSelect.innerHTML = '';
    
    let validSeasons = detailedShow.seasons.filter(s => s.season_number > 0);
    if (validSeasons.length === 0 && detailedShow.seasons.length > 0) {
      validSeasons = [detailedShow.seasons[0]];
    }

    validSeasons.forEach(season => {
      const option = document.createElement('option');
      option.value = season.season_number;
      option.textContent = `Season ${season.season_number} (${season.episode_count} Ep)`;
      option.dataset.epCount = season.episode_count;
      seasonSelect.appendChild(option);
    });

    onSeasonChange();
  } catch (error) {
    console.error("Error reading seasonal sequence log:", error);
    seasonSelect.innerHTML = '<option value="1">Season 1 [Fallback Mode]</option>';
    onSeasonChange();
  }
}

function onSeasonChange() {
  const seasonSelect = document.getElementById('season-select');
  const selectedOption = seasonSelect.options[seasonSelect.selectedIndex];
  if (!selectedOption) return;

  const episodeCount = parseInt(selectedOption.dataset.epCount, 10) || 1;
  const episodeSelect = document.getElementById('episode-select');
  episodeSelect.innerHTML = '';

  for (let i = 1; i <= episodeCount; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `Episode ${i}`;
    episodeSelect.appendChild(option);
  }

  changeServer();
}

function changeServer() {
  if (!currentItem || currentItem.is_upcoming) return; // Prevent fire sequencing on unreleased links
  
  const server = document.getElementById('server').value;
  const type = currentItem.media_type === "movie" ? "movie" : "tv";
  let embedURL = "";

  const seasonSelectElement = document.getElementById('season-select');
  const episodeSelectElement = document.getElementById('episode-select');
  
  const season = seasonSelectElement && seasonSelectElement.value ? seasonSelectElement.value : "1";
  const episode = episodeSelectElement && episodeSelectElement.value ? episodeSelectElement.value : "1";

  if (server === "vidsrc.cc") {
    embedURL = type === "movie" 
      ? `https://vidsrc.cc/v2/embed/${type}/${currentItem.id}`
      : `https://vidsrc.cc/v2/embed/${type}/${currentItem.id}/${season}/${episode}`;
  } else if (server === "vidsrc.me") {
    embedURL = type === "movie"
      ? `https://vidsrc.net/embed/${type}/?tmdb=${currentItem.id}`
      : `https://vidsrc.net/embed/${type}/?tmdb=${currentItem.id}&season=${season}&episode=${episode}`;
  } else if (server === "player.videasy.net") {
    embedURL = type === "movie"
      ? `https://player.videasy.net/${type}/${currentItem.id}`
      : `https://player.videasy.net/${type}/${currentItem.id}/${season}/${episode}`;
  }

  const iframe = document.getElementById('modal-video');
  iframe.removeAttribute('sandbox');
  iframe.src = embedURL;
}

function closeModal() {
  document.getElementById('modal').style.display = 'none';
  document.getElementById('modal-video').src = '';
}

function openSearchModal() {
  document.getElementById('search-modal').style.display = 'flex';
  document.getElementById('search-input').focus();
}

function closeSearchModal() {
  document.getElementById('search-modal').style.display = 'none';
  document.getElementById('search-results').innerHTML = '';
  document.getElementById('search-input').value = '';
}

async function searchTMDB() {
  const query = document.getElementById('search-input').value;
  if (!query.trim()) {
    document.getElementById('search-results').innerHTML = '';
    return;
  }

  try {
    const res = await fetch(`${BASE_URL}/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(query)}`);
    const data = await res.json();
    const container = document.getElementById('search-results');
    container.innerHTML = '';
    
    data.results.forEach(item => {
      if (!item.poster_path || item.media_type === 'person') return;
      
      const img = document.createElement('img');
      img.src = `${IMG_URL}${item.poster_path}`;
      img.alt = item.title || item.name;
      img.onclick = () => {
        closeSearchModal();
        showDetails(item);
      };
      container.appendChild(img);
    });
  } catch (error) {
    console.error("Database tracking lookup aborted:", error);
  }
}

async function init() {
  await fetchAndInjectGenres();
  
  // Prime baseline defaults on standard trending matrices
  rawMoviesCache = await fetchMediaData('movie', 'all');
  rawTvShowsCache = await fetchMediaData('tv', 'all');
  rawAnimeCache = await fetchAnimeData('all');
  rawUpcomingCache = await fetchUpcomingMovies('all'); // Load upcoming list baseline defaults

  if (rawMoviesCache.length > 0) {
    displayBanner(rawMoviesCache[Math.floor(Math.random() * rawMoviesCache.length)]);
  }
  
  displayList(rawMoviesCache, 'movies-list');
  displayList(rawTvShowsCache, 'tvshows-list');
  displayList(rawAnimeCache, 'anime-list');
  displayList(rawUpcomingCache, 'upcoming-list'); // Inject upcoming elements into UI list layout
}

init();