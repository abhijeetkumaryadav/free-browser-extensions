/* Frame-Accurate Video Cutter — popup logic.
 * - Upload a video, step ±1/±10 frames (fps is user-settable, default 30).
 * - Set IN/OUT cut points, scrub, preview the clip in place.
 * - Export re-encodes the chosen range via canvas.captureStream + MediaRecorder.
 * - Labeled: cuts at chosen frames via re-encode — NOT lossless keyframe cutting. */

const $ = (id) => document.getElementById(id);
const fileInput = $("file"), drop = $("drop"), editor = $("editor");
const video = $("video"), tc = $("tc"), fr = $("fr"), fpsInput = $("fps");
const scrub = $("scrub"), inLbl = $("inLbl"), outLbl = $("outLbl");
const playBtn = $("play"), previewBtn = $("preview"), exportBtn = $("export");
const prog = $("prog"), bar = $("bar"), dl = $("dl");

let objUrl = null;
let inT = null, outT = null;
let exporting = false;

const fps = () => Math.max(1, Math.min(120, parseFloat(fpsInput.value) || 30));
const frameDur = () => 1 / fps();

function fmt(t) {
  t = Math.max(0, t);
  const m = Math.floor(t / 60), s = Math.floor(t % 60), cs = Math.floor((t % 1) * 100);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}
function frameOf(t) { return Math.round(t / frameDur()); }

function refresh() {
  tc.textContent = fmt(video.currentTime);
  fr.textContent = `frame ${frameOf(video.currentTime)}`;
  if (video.duration) scrub.value = Math.round((video.currentTime / video.duration) * 1000);
  inLbl.textContent = inT === null ? "—" : fmt(inT);
  outLbl.textContent = outT === null ? "—" : fmt(outT);
}

function seekTo(t) {
  if (!video.duration) return;
  video.currentTime = Math.max(0, Math.min(video.duration, t));
}
function stepFrames(n) {
  seekTo(video.currentTime + n * frameDur());
  video.pause();
  playBtn.textContent = "▶";
}

function loadFile(f) {
  if (!f || !f.type.startsWith("video/")) return;
  if (objUrl) URL.revokeObjectURL(objUrl);
  objUrl = URL.createObjectURL(f);
  video.src = objUrl;
  inT = null; outT = null;
  dl.classList.add("hidden");
  editor.classList.remove("hidden");
}

fileInput.addEventListener("change", () => loadFile(fileInput.files[0]));
drop.addEventListener("click", () => fileInput.click());
["dragover", "dragenter"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", (e) => loadFile(e.dataTransfer.files[0]));

video.addEventListener("loadedmetadata", refresh);
video.addEventListener("timeupdate", refresh);
video.addEventListener("seeked", refresh);

playBtn.addEventListener("click", () => {
  if (video.paused) { video.play(); playBtn.textContent = "⏸"; }
  else { video.pause(); playBtn.textContent = "▶"; }
});
$("back1").addEventListener("click", () => stepFrames(-1));
$("fwd1").addEventListener("click", () => stepFrames(1));
$("back10").addEventListener("click", () => stepFrames(-10));
$("fwd10").addEventListener("click", () => stepFrames(10));
scrub.addEventListener("input", () => {
  if (video.duration) { seekTo((scrub.value / 1000) * video.duration); video.pause(); playBtn.textContent = "▶"; }
});

$("setIn").addEventListener("click", () => { inT = video.currentTime; refresh(); });
$("setOut").addEventListener("click", () => { outT = video.currentTime; refresh(); });

function validRange() {
  if (inT === null || outT === null) { alert("Set both IN and OUT points first."); return null; }
  if (outT <= inT) { alert("OUT must be after IN."); return null; }
  return [inT, outT];
}

// Preview: play only the chosen range, looping
previewBtn.addEventListener("click", () => {
  const r = validRange();
  if (!r) return;
  const [a, b] = r;
  video.currentTime = a;
  video.play();
  playBtn.textContent = "⏸";
  const onTick = () => {
    if (video.currentTime >= b) { video.pause(); playBtn.textContent = "▶"; video.removeEventListener("timeupdate", onTick); }
  };
  video.addEventListener("timeupdate", onTick);
});

// Export: re-encode range via canvas capture + MediaRecorder
exportBtn.addEventListener("click", async () => {
  const r = validRange();
  if (!r || exporting) return;
  const [a, b] = r;
  exporting = true;
  prog.classList.remove("hidden");
  dl.classList.add("hidden");
  bar.style.width = "0%";

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  const stream = canvas.captureStream(fps());
  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

  const done = new Promise((resolve) => { rec.onstop = resolve; });
  video.currentTime = a;
  await new Promise((res) => video.addEventListener("seeked", res, { once: true }));
  rec.start(250);

  await new Promise((resolve) => {
    const draw = () => {
      if (video.currentTime >= b || video.ended) { resolve(); return; }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      bar.style.width = `${Math.min(100, ((video.currentTime - a) / (b - a)) * 100)}%`;
      requestAnimationFrame(draw);
    };
    video.play();
    draw();
  });

  video.pause();
  rec.stop();
  await done;
  bar.style.width = "100%";
  const blob = new Blob(chunks, { type: "video/webm" });
  dl.href = URL.createObjectURL(blob);
  dl.download = "clip_cut.webm";
  dl.textContent = `Download clip (${fmt(b - a)}, ${(blob.size / 1048576).toFixed(1)} MB)`;
  dl.classList.remove("hidden");
  exporting = false;
  refresh();
});
