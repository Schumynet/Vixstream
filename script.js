function watch() {
  const id = document.getElementById("videoId").value;
  const video = document.getElementById("video");
  const hls = new Hls();
  hls.loadSource(`https://vixstreamproxy.onrender.com/watch?id=${id}`);
  hls.attachMedia(video);
}
