function watch() {
  const id = document.getElementById("videoId").value;
  const video = document.getElementById("video");
  const hls = new Hls();
  hls.loadSource(`https://fabio-backend.onrender.com/watch?id=${id}`);
  hls.attachMedia(video);
}
