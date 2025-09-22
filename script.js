// script.js

const BACKEND_URL = "https://vixstreamproxy.onrender.com";

function showError(container, message) {
  container.innerHTML = `
    <div class="bg-black text-red-500 p-4 text-center rounded">
      ❌ ${message}
    </div>
  `;
}

async function search() {
  const query = document.getElementById("searchInput").value.trim();
  const resultsContainer = document.getElementById("results");
  const playerContainer = document.getElementById("player");

  resultsContainer.innerHTML = "";
  playerContainer.innerHTML = "";

  if (!query) return;

  try {
    const res = await fetch(`${BACKEND_URL}/search?query=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (!data || data.length === 0) {
      resultsContainer.innerHTML = "<p class='text-center text-red-500'>Nessun risultato trovato.</p>";
      return;
    }

    data.forEach(item => {
      const { tmdb_id, title, poster, overview, type } = item;

      const card = document.createElement("div");
      card.className = "bg-gray-800 p-4 rounded shadow hover:shadow-lg transition";

      card.innerHTML = `
        <img src="${poster}" alt="${title}" class="w-full h-64 object-cover rounded mb-4" />
        <h2 class="text-xl font-semibold mb-2">${title}</h2>
        <p class="text-sm text-gray-400 mb-4">${overview}</p>
        <button onclick="watch(${tmdb_id}, '${type}')" class="bg-green-600 px-4 py-2 rounded hover:bg-green-700">Guarda ora</button>
      `;

      resultsContainer.appendChild(card);
    });
  } catch (err) {
    console.error("Errore nella ricerca:", err);
    resultsContainer.innerHTML = "<p class='text-center text-red-500'>Errore durante la ricerca.</p>";
  }
}

async function watch(tmdbId, type) {
  const playerContainer = document.getElementById("player");
  playerContainer.innerHTML = "";

  const endpoint = type === "movie"
    ? `/hls/movie/${tmdbId}`
    : `/hls/show/${tmdbId}/1/1`;

  try {
    const res = await fetch(`${BACKEND_URL}${endpoint}`);
    const data = await res.json();

    if (!data.video || !data.video[0] || !data.video[0].url) {
      showError(playerContainer, "Stream non disponibile.");
      return;
    }

    loadVideo(data.video[0].url); // definita in player.js
  } catch (err) {
    console.error("Errore nel caricamento del video:", err);
    showError(playerContainer, "Errore di rete o backend.");
  }
}


const TMDB_API_KEY = "be78689897669066bef6906e501b0e10";
const TMDB_BASE = "https://api.themoviedb.org/3";
const VIX_BACKEND = "https://vixstreamproxy.onrender.com";
const GENRES = [28, 35, 18, 27]; // Action, Comedy, Drama, Horror

async function getDisponibili() {
  const res = await fetch(`${VIX_BACKEND}/home/available`);
  return await res.json(); // [{ tmdb_id, type }]
}

async function fetchTMDB(path) {
  const url = `${TMDB_BASE}/${path}?api_key=${TMDB_API_KEY}&language=it-IT`;
  const res = await fetch(url);
  const data = await res.json();
  return data.results || [];
}

function filtraDisponibili(lista, disponibili, tipo) {
  return lista.filter(item =>
    disponibili.some(d => d.tmdb_id === item.id && d.type === tipo)
  );
}

function creaCard(item) {
  const div = document.createElement("div");
  div.className = "card";
  div.innerHTML = `
    <img src="https://image.tmdb.org/t/p/w300${item.poster_path}" alt="${item.title || item.name}" />
    <p>${item.title || item.name}</p>
  `;
  div.onclick = () => play(item.id, item.media_type || "movie");
  return div;
}

function renderSection(titolo, lista, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  lista.forEach(item => container.appendChild(creaCard(item)));
}

function play(id, tipo) {
  const video = document.getElementById("videoPlayer");
  const url = tipo === "movie"
    ? `${VIX_BACKEND}/hls/movie/${id}`
    : `${VIX_BACKEND}/hls/show/${id}/1/1`;
  if (Hls.isSupported()) {
    const hls = new Hls();
    hls.loadSource(url);
    hls.attachMedia(video);
  } else {
    video.src = url;
  }
  video.play();
}

async function initHomepage() {
  const disponibili = await getDisponibili();

  const trending = await fetchTMDB("trending/movie/week");
  renderSection("In Tendenza",
    filtraDisponibili(trending, disponibili, "movie"),
    "trendingMovies"
  );

  const topRated = await fetchTMDB("movie/top_rated");
  renderSection("I Più Votati",
    filtraDisponibili(topRated, disponibili, "movie"),
    "topRatedMovies"
  );

  const upcoming = await fetchTMDB("movie/upcoming");
  renderSection("Prossime Uscite",
    filtraDisponibili(upcoming, disponibili, "movie"),
    "upcomingMovies"
  );

  const popularTv = await fetchTMDB("tv/popular");
  renderSection("Serie TV Popolari",
    filtraDisponibili(popularTv, disponibili, "tv"),
    "popularTv"
  );

  for (const genreId of GENRES) {
    const movieGenre = await fetchTMDB(`discover/movie&with_genres=${genreId}`);
    const tvGenre    = await fetchTMDB(`discover/tv&with_genres=${genreId}`);

    const movies = filtraDisponibili(movieGenre, disponibili, "movie");
    const series = filtraDisponibili(tvGenre, disponibili, "tv");

    const combined = [...movies, ...series];
    renderSection(`Genere ${genreId}`, combined, `genre_${genreId}`);
  }
}

document.addEventListener("DOMContentLoaded", initHomepage);