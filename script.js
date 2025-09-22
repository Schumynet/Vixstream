const TMDB_API_KEY = "be78689897669066bef6906e501b0e10";

async function search() {
  const query = document.getElementById("searchInput").value;
  const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${query}`);
  const data = await res.json();

  const container = document.getElementById("results");
  container.innerHTML = "";

  data.results.forEach(item => {
    const tmdbId = item.id;
    const title = item.title || item.name;
    const poster = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "";
    const overview = item.overview || "Nessuna descrizione disponibile";
    const type = item.media_type;

    const card = document.createElement("div");
    card.className = "bg-gray-800 p-4 rounded shadow";

    card.innerHTML = `
      <img src="${poster}" alt="${title}" class="rounded mb-2">
      <h2 class="text-xl font-semibold">${title}</h2>
      <p class="text-sm mb-2">${overview}</p>
      <button onclick="watch('${tmdbId}', '${type}')" class="bg-green-600 px-4 py-2 rounded hover:bg-green-700">Guarda</button>
    `;

    container.appendChild(card);
  });
}

async function watch(tmdbId, type) {
  const endpoint = type === "movie"
    ? `/stream/movie/${tmdbId}`
    : `/stream/show/${tmdbId}/1/1`; // default S01E01

  const res = await fetch(`https://fabio-backend.onrender.com${endpoint}`);
  const html = await res.text();

  document.getElementById("player").innerHTML = html;
}

async function watch(tmdbId, type) {
  const endpoint = type === "movie"
    ? `/hls/movie/${tmdbId}`
    : `/hls/show/${tmdbId}/1/1`;

  try {
    const res = await fetch(`https://vixstreamproxy.onrender.com${endpoint}`);
    const manifest = await res.text();

    if (!manifest.includes("#EXTM3U")) {
      showError(document.getElementById("player"), "Stream non disponibile.");
      return;
    }

    const blob = new Blob([manifest], { type: "application/vnd.apple.mpegurl" });
    const manifestUrl = URL.createObjectURL(blob);

    loadVideo(manifestUrl);
  } catch (err) {
    console.error(err);
    showError(document.getElementById("player"), "Errore di rete o backend.");
  }
}