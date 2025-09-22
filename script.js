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
