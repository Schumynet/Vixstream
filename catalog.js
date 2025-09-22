const BACKEND_URL = "https://vixstreamproxy.onrender.com";
const TMDB_API_KEY = "be78689897669066bef6906e501b0e10"; // usa la tua chiave
const TMDB_BASE = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p/w300";
const catalogContainer = document.getElementById("catalogo");

async function loadCatalog() {
  const disponibili = await fetch(`${BACKEND_URL}/home/available`).then(r => r.json());

  for (const item of disponibili) {
    try {
      let tmdbData;

      if (item.type === "movie") {
        tmdbData = await fetch(`${TMDB_BASE}/movie/${item.tmdb_id}?api_key=${TMDB_API_KEY}&language=it-IT`)
          .then(r => r.json());
      } else if (item.type === "tv") {
        tmdbData = await fetch(`${TMDB_BASE}/tv/${item.tmdb_id}?api_key=${TMDB_API_KEY}&language=it-IT`)
          .then(r => r.json());
      } else {
        continue;
      }

      const title = tmdbData.title || tmdbData.name || "Senza titolo";
      const overview = tmdbData.overview || "Nessuna descrizione disponibile.";
      const poster = tmdbData.poster_path ? `${IMAGE_BASE}${tmdbData.poster_path}` : "fallback.jpg";
      const vote = tmdbData.vote_average ? `${tmdbData.vote_average}/10` : "N/A";

      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <img src="${poster}" alt="${title}" />
        <h3>${title}</h3>
        <p>${overview}</p>
        <span class="vote">⭐ ${vote}</span>
        <button onclick="watchContent(${item.tmdb_id}, '${item.type}')">Guarda ora</button>
      `;
      catalogContainer.appendChild(card);
    } catch (err) {
      console.warn("Errore TMDB per", item.tmdb_id, err);
    }
  }
}

async function watchContent(tmdbId, type) {
  const endpoint = type === "movie"
    ? `/hls/movie/${tmdbId}`
    : `/hls/show/${tmdbId}/1/1`;

  try {
    const res = await fetch(`${BACKEND_URL}${endpoint}`);
    const data = await res.json();
    if (!data.url) return alert("Stream non disponibile");

    loadVideo(data.url); // usa il tuo player.js
  } catch (err) {
    console.error("Errore riproduzione:", err);
    alert("Errore nel caricamento del video");
  }
}

loadCatalog();